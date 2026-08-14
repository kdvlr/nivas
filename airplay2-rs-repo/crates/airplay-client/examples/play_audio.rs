//! Play audio file to AirPlay device
//!
//! Run with: sudo cargo run --example play_audio -- <ip> <port> <audio-file>
//! Example: sudo cargo run --example play_audio -- 192.168.0.103 7000 test.mp3

use airplay_audio::{AlacEncoder, AudioDecoder};
use airplay_client::{Connection, RaopConnection};
use airplay_core::device::{Device, DeviceId};
use airplay_core::features::Features;
use airplay_core::stream::{PtpMode, StreamType, TimingProtocol};
use airplay_core::{AudioCodec, AudioFormat, StreamConfig};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::net::IpAddr;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::sync::mpsc;

#[derive(Debug)]
enum DacpCommand {
    Pause,
    Play,
    PlayPause,
    Next,
    Prev,
}

#[derive(Clone)]
struct DacpState {
    title: String,
    artist: String,
    album: String,
    duration_ms: u32,
    position_ms: u32,
    state: airplay_client::PlaybackState,
    volume: u8,
}

fn build_dmap_tag(tag: &[u8; 4], data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(8 + data.len());
    out.extend_from_slice(tag);
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    out.extend_from_slice(data);
    out
}

fn build_play_status_response(state: &DacpState) -> Vec<u8> {
    let mut inner = Vec::new();
    inner.extend_from_slice(&build_dmap_tag(b"mstt", &(200u32).to_be_bytes()));
    let caps_val: u8 = match state.state {
        airplay_client::PlaybackState::Playing => 3,
        airplay_client::PlaybackState::Paused => 2,
        _ => 1,
    };
    inner.extend_from_slice(&build_dmap_tag(b"caps", &[caps_val]));
    if !state.title.is_empty() {
        inner.extend_from_slice(&build_dmap_tag(b"cann", state.title.as_bytes()));
    }
    if !state.artist.is_empty() {
        inner.extend_from_slice(&build_dmap_tag(b"cana", state.artist.as_bytes()));
    }
    if !state.album.is_empty() {
        inner.extend_from_slice(&build_dmap_tag(b"canl", state.album.as_bytes()));
    }
    inner.extend_from_slice(&build_dmap_tag(b"cant", &(state.position_ms).to_be_bytes()));
    inner.extend_from_slice(&build_dmap_tag(b"cast", &(state.duration_ms).to_be_bytes()));
    inner.extend_from_slice(&build_dmap_tag(b"cmvo", &(state.volume as u32).to_be_bytes()));
    build_dmap_tag(b"cmst", &inner)
}

#[derive(Debug, Clone)]
struct TrackInfoPayload {
    path: String,
    duration: f64,
    title: String,
    artist: String,
    album: String,
    artwork_path: Option<String>,
}

#[derive(Debug)]
enum SourceCommand {
    Pause,
    Resume,
    Volume { target: Option<IpAddr>, value: f32 },
    Track(TrackInfoPayload),
    Stop,
}

fn parse_source_command(line: &str) -> Option<SourceCommand> {
    let trimmed = line.trim();
    if trimmed.starts_with("track ") {
        let json_str = trimmed["track ".len()..].trim();
        #[derive(serde::Deserialize)]
        struct TrackJson {
            path: String,
            duration: Option<f64>,
            title: Option<String>,
            artist: Option<String>,
            album: Option<String>,
            artwork: Option<String>,
        }
        if let Ok(data) = serde_json::from_str::<TrackJson>(json_str) {
            return Some(SourceCommand::Track(TrackInfoPayload {
                path: data.path,
                duration: data.duration.unwrap_or(0.0),
                title: data.title.unwrap_or_else(|| "Unknown Title".to_string()),
                artist: data.artist.unwrap_or_else(|| "Unknown Artist".to_string()),
                album: data.album.unwrap_or_else(|| "Nivas".to_string()),
                artwork_path: data.artwork,
            }));
        }
    }

    let mut parts = trimmed.split_whitespace();
    match parts.next()?.to_ascii_lowercase().as_str() {
        "pause" => Some(SourceCommand::Pause),
        "resume" | "play" => Some(SourceCommand::Resume),
        "stop" | "quit" | "exit" => Some(SourceCommand::Stop),
        "volume" => {
            let first = parts.next()?;
            if let Ok(value) = first.parse::<f32>() {
                Some(SourceCommand::Volume {
                    target: None,
                    value: value.clamp(0.0, 1.0),
                })
            } else {
                let target = first.parse::<IpAddr>().ok()?;
                let value = parts.next()?.parse::<f32>().ok()?.clamp(0.0, 1.0);
                Some(SourceCommand::Volume {
                    target: Some(target),
                    value,
                })
            }
        }
        _ => None,
    }
}

fn start_source_control(command_tx: mpsc::UnboundedSender<SourceCommand>) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(tokio::io::stdin()).lines();
        loop {
            match lines.next_line().await {
                Ok(Some(line)) => match parse_source_command(&line) {
                    Some(command) => {
                        if command_tx.send(command).is_err() {
                            break;
                        }
                    }
                    None => tracing::warn!("Ignoring invalid source command: {}", line),
                },
                Ok(None) => {
                    // The owning Nivas process closed the control pipe. Treat
                    // that as a stop so RTSP, RTP, PTP, and event sockets are
                    // released instead of becoming an orphaned session.
                    let _ = command_tx.send(SourceCommand::Stop);
                    break;
                }
                Err(error) => {
                    tracing::warn!("Source control input failed: {}", error);
                    let _ = command_tx.send(SourceCommand::Stop);
                    break;
                }
            }
        }
    });
}

fn start_shutdown_handler(command_tx: mpsc::UnboundedSender<SourceCommand>) {
    tokio::spawn(async move {
        #[cfg(unix)]
        {
            use tokio::signal::unix::{signal, SignalKind};
            let mut terminate = signal(SignalKind::terminate()).ok();
            let mut interrupt = signal(SignalKind::interrupt()).ok();
            tokio::select! {
                _ = async {
                    if let Some(signal) = terminate.as_mut() {
                        signal.recv().await;
                    } else {
                        std::future::pending::<()>().await;
                    }
                } => {}
                _ = async {
                    if let Some(signal) = interrupt.as_mut() {
                        signal.recv().await;
                    } else {
                        std::future::pending::<()>().await;
                    }
                } => {}
            }
        }
        #[cfg(not(unix))]
        {
            let _ = tokio::signal::ctrl_c().await;
        }
        let _ = command_tx.send(SourceCommand::Stop);
    });
}

fn airplay_event_command(data: &[u8]) -> Option<DacpCommand> {
    // These are the four-character MediaRemote command values in the binary
    // plist body of POST /command. The leading `T` is the binary-plist marker
    // for a four-byte ASCII string.
    if data.windows(5).any(|value| value == b"Tpaus") {
        Some(DacpCommand::Pause)
    } else if data.windows(5).any(|value| value == b"Tplay") {
        Some(DacpCommand::Play)
    } else {
        None
    }
}

async fn start_dacp_server(
    dacp_id: &str,
    active_remote: &str,
    receiver_ip: IpAddr,
    shared_state: std::sync::Arc<tokio::sync::RwLock<DacpState>>,
) -> Result<(ServiceDaemon, mpsc::UnboundedReceiver<DacpCommand>), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("0.0.0.0:0").await?;
    let port = listener.local_addr()?.port();
    let route_socket = std::net::UdpSocket::bind("0.0.0.0:0")?;
    route_socket.connect((receiver_ip, 7000))?;
    let advertised_ip = route_socket.local_addr()?.ip().to_string();
    let mdns = ServiceDaemon::new()?;
    let instance = format!("iTunes_Ctrl_{}", dacp_id);
    let properties = [
        ("txtvers", "1"),
        ("DbId", dacp_id),
        ("OSsi", "0x0000000000000000"),
        ("CtlN", "Nivas"),
        ("Ver", "131073"),
        ("DvSv", "2049"),
        ("DvTy", "AirPlay"),
    ];
    let service = ServiceInfo::new(
        "_dacp._tcp.local.",
        &instance,
        "nivas-dacp.local.",
        &advertised_ip,
        port,
        &properties[..],
    )?;
    mdns.register(service)?;

    let expected_active_remote = active_remote.to_string();
    let (command_tx, command_rx) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        loop {
            let Ok((mut stream, peer)) = listener.accept().await else {
                break;
            };
            let command_tx = command_tx.clone();
            let expected_active_remote = expected_active_remote.clone();
            let shared_state = shared_state.clone();
            tokio::spawn(async move {
                let mut request = vec![0u8; 8192];
                let Ok(length) = stream.read(&mut request).await else {
                    return;
                };
                request.truncate(length);
                let text = String::from_utf8_lossy(&request);
                let request_line = text.lines().next().unwrap_or_default();
                let authorized = text.lines().any(|line| {
                    line.trim()
                        .eq_ignore_ascii_case(&format!("Active-Remote: {}", expected_active_remote))
                });
                tracing::info!(
                    "DACP request from {}: {} (authorized={})",
                    peer,
                    request_line,
                    authorized
                );

                if request_line.contains("/ctrl-int/1/playstatusupdate") || request_line.contains("/ctrl-int/1/getproperty") {
                    let state_guard = shared_state.read().await;
                    let dmap_body = build_play_status_response(&state_guard);
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/x-dmap-tagged\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        dmap_body.len()
                    );
                    let mut resp_bytes = resp.into_bytes();
                    resp_bytes.extend_from_slice(&dmap_body);
                    let _ = stream.write_all(&resp_bytes).await;
                    return;
                }

                let command = if request_line.contains("/ctrl-int/1/playpause") {
                    Some(DacpCommand::PlayPause)
                } else if request_line.contains("/ctrl-int/1/pause") {
                    Some(DacpCommand::Pause)
                } else if request_line.contains("/ctrl-int/1/play") {
                    Some(DacpCommand::Play)
                } else if request_line.contains("/ctrl-int/1/nextitem") {
                    Some(DacpCommand::Next)
                } else if request_line.contains("/ctrl-int/1/previtem") {
                    Some(DacpCommand::Prev)
                } else {
                    None
                };
                if let Some(command) = command {
                    let _ = command_tx.send(command);
                }

                let _ = stream
                    .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                    .await;
            });
        }
    });

    println!(
        "DACP service {} published at {}:{}",
        instance, advertised_ip, port
    );
    Ok((mdns, command_rx))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configure Tokio runtime with 4 worker threads for Pi's 4 cores
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()?;

    runtime.block_on(async_main())
}

async fn async_main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(true)
        .init();

    let args: Vec<String> = std::env::args().collect();
    if args.len() < 4 {
        eprintln!("Usage: {} <ip> <port> <audio-file> [OPTIONS]", args[0]);
        eprintln!(
            "Example: {} 192.168.0.103 7000 music.mp3 --airplay2 --ptp-slave",
            args[0]
        );
        eprintln!("\nOptions:");
        eprintln!("  --airplay1       RAOP connection (AirPlay 1, no pairing) (default)");
        eprintln!("  --airplay2       AirPlay 2 connection (HomeKit pairing)");
        eprintln!("  --pin PIN        Apple TV PIN pairing (HomeKit Normal, e.g., --pin 1234)");
        eprintln!("  --ptp            Use PTP timing (default: NTP)");
        eprintln!(
            "  --ptp-master     PTP: Act as timing master (for 3rd-party receivers) (default)"
        );
        eprintln!("  --ptp-slave      PTP: Act as timing slave (for HomePod multi-room)");
        eprintln!("  --render-delay N Render delay in ms (shifts NTP timestamps forward for retransmit headroom)");
        eprintln!("  --device-id ID   Device ID for pair-verify (e.g., 4E:44:4C:1E:C3:B5)");
        eprintln!("  --force-transient Force transient pairing (skip pair-verify even if identity exists)");
        eprintln!("  --control-stdin Read pause/resume/volume/stop commands from stdin");
        eprintln!("  --title TEXT     Now-playing track title");
        eprintln!("  --artist TEXT    Now-playing artist");
        eprintln!("  --album TEXT     Now-playing album");
        eprintln!("  --artwork PATH   JPEG artwork to show on receivers");
        eprintln!("  --duration SEC   Track duration for receiver progress display");
        std::process::exit(1);
    }

    let ips: Vec<IpAddr> = args[1]
        .split(',')
        .map(|s| s.trim().parse().expect("Invalid IP address"))
        .collect();

    let option_value = |name: &str| {
        args.iter()
            .position(|argument| argument == name)
            .and_then(|index| args.get(index + 1))
            .cloned()
    };
    let metadata_title = option_value("--title").unwrap_or_else(|| "YouTube Music".to_string());
    let metadata_artist = option_value("--artist").unwrap_or_else(|| "Nivas AirPlay".to_string());
    let metadata_album = option_value("--album").unwrap_or_else(|| "Nivas".to_string());
    let artwork_path = option_value("--artwork");
    let metadata_duration = option_value("--duration")
        .and_then(|value| value.parse::<f64>().ok());

    let dacp_state = std::sync::Arc::new(tokio::sync::RwLock::new(DacpState {
        title: metadata_title.clone(),
        artist: metadata_artist.clone(),
        album: metadata_album.clone(),
        duration_ms: (metadata_duration.unwrap_or(0.0) * 1000.0) as u32,
        position_ms: 0,
        state: airplay_client::PlaybackState::Playing,
        volume: 70,
    }));

    let use_dacp = args.iter().any(|a| a == "--dacp");
    let active_remote = "1234567890";
    let dacp_device_id = "4E:49:56:41:53:01";
    let dacp_id = dacp_device_id.replace(':', "");
    let (dacp_daemon, mut dacp_commands) = if use_dacp {
        std::env::set_var("AIRPLAY_CLIENT_DEVICE_ID", dacp_device_id);
        let (daemon, receiver) = start_dacp_server(&dacp_id, active_remote, ips[0], dacp_state.clone()).await?;
        (Some(daemon), Some(receiver))
    } else {
        (None, None)
    };
    let port: u16 = args[2].parse()?;
    let audio_path = &args[3];

    // Parse optional protocol flags (default: airplay1/RAOP with NTP)
    let use_airplay2 = args.iter().any(|a| a == "--airplay2");
    let control_stdin = args.iter().any(|a| a == "--control-stdin");
    let source_pause_test = args.iter().any(|a| a == "--source-pause-test");
    let handle_remote_events = args.iter().any(|a| a == "--remote-control-events");
    let use_ptp = args.iter().any(|a| a == "--ptp");
    let ptp_targets: Vec<IpAddr> = args
        .iter()
        .position(|a| a == "--ptp-targets")
        .and_then(|i| args.get(i + 1))
        .map(|value| {
            value
                .split(',')
                .map(|ip| ip.trim().parse().expect("Invalid --ptp-targets IP"))
                .collect()
        })
        .unwrap_or_default();
    let ptp_slave = args.iter().any(|a| a == "--ptp-slave");
    let ptp_master = args.iter().any(|a| a == "--ptp-master");
    let render_delay_ms: u32 = args
        .iter()
        .position(|a| a == "--render-delay")
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    let initial_volume: Option<f32> = args
        .iter()
        .position(|a| a == "--volume")
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse().ok());
    let option_value = |name: &str| {
        args.iter()
            .position(|argument| argument == name)
            .and_then(|index| args.get(index + 1))
            .cloned()
    };
    let metadata_title = option_value("--title").unwrap_or_else(|| "YouTube Music".to_string());
    let metadata_artist = option_value("--artist").unwrap_or_else(|| "Nivas AirPlay".to_string());
    let metadata_album = option_value("--album").unwrap_or_else(|| "Nivas".to_string());
    let artwork_path = option_value("--artwork");
    let metadata_duration = option_value("--duration")
        .and_then(|value| value.parse::<f64>().ok());
    let volume_steps: Vec<(f64, f32)> = args
        .iter()
        .position(|a| a == "--volume-steps")
        .and_then(|i| args.get(i + 1))
        .map(|value| {
            value
                .split(',')
                .map(|step| {
                    let (seconds, volume) = step
                        .split_once(':')
                        .expect("Volume step must be SECONDS:VOLUME");
                    (
                        seconds.parse().expect("Invalid volume-step time"),
                        volume.parse().expect("Invalid volume-step value"),
                    )
                })
                .collect()
        })
        .unwrap_or_default();

    let (source_command_tx, mut source_commands) = mpsc::unbounded_channel();
    if control_stdin {
        start_source_control(source_command_tx.clone());
    }
    start_shutdown_handler(source_command_tx);

    // Device ID for identity lookup (pair-verify)
    // If not specified, derive from IP address for consistent identity per device
    let device_id_str: String = args
        .iter()
        .position(|a| a == "--device-id")
        .and_then(|i| args.get(i + 1))
        .cloned()
        .unwrap_or_else(|| {
            // Derive device ID from IP address octets
            match ips[0] {
                IpAddr::V4(v4) => {
                    let octets = v4.octets();
                    format!(
                        "{:02X}:{:02X}:{:02X}:{:02X}:00:00",
                        octets[0], octets[1], octets[2], octets[3]
                    )
                }
                IpAddr::V6(v6) => {
                    let segments = v6.segments();
                    format!(
                        "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
                        (segments[0] >> 8) as u8,
                        segments[0] as u8,
                        (segments[1] >> 8) as u8,
                        segments[1] as u8,
                        (segments[2] >> 8) as u8,
                        segments[2] as u8
                    )
                }
            }
        });

    // Force transient pairing (skip pair-verify)
    let force_transient = args.iter().any(|a| a == "--force-transient");

    // PIN pairing for Apple TV (accepts both --pin and legacy --fruit)
    let pin_arg: Option<String> = args
        .iter()
        .position(|a| a == "--pin" || a == "--fruit")
        .and_then(|i| args.get(i + 1))
        .cloned();

    let timing_protocol = if use_ptp {
        TimingProtocol::Ptp
    } else {
        TimingProtocol::Ntp
    };

    let ptp_mode = if ptp_slave {
        PtpMode::Slave
    } else {
        PtpMode::Master // Default to master
    };

    let protocol_name = if use_airplay2 {
        if use_ptp {
            if ptp_slave {
                "AirPlay 2 (PTP Slave)"
            } else {
                "AirPlay 2 (PTP Master)"
            }
        } else {
            "AirPlay 2 (NTP)"
        }
    } else {
        "AirPlay 1 / RAOP (NTP)"
    };
    println!("=== AirPlay Audio Test ===");
    println!("Target IPs: {:?}", ips);
    println!("Protocol: {}", protocol_name);
    if render_delay_ms > 0 {
        println!("Render delay: {}ms", render_delay_ms);
    }
    println!("Audio file: {}", audio_path);

    // Open audio file first to validate it
    let decoder = AudioDecoder::open(audio_path)?;
    let duration_secs = decoder
        .duration_samples()
        .map(|s| s as f64 / decoder.sample_rate() as f64)
        .unwrap_or(0.0);
    println!(
        "Audio: {}Hz, {} channels, duration: {:.1}s",
        decoder.sample_rate(),
        decoder.channels(),
        duration_secs
    );

    let use_aac = args.iter().any(|a| a == "--aac");
    let use_buffered = args.iter().any(|a| a == "--buffered");

    let audio_format = if use_aac {
        AudioFormat {
            codec: AudioCodec::Aac,
            sample_rate: airplay_core::codec::SampleRate::Hz44100,
            bit_depth: 16,
            channels: 2,
            frames_per_packet: 1024,
        }
    } else {
        AudioFormat::default() // ALAC 44100/16-bit/stereo, 352 spf
    };

    let stream_type = if use_buffered || use_aac {
        StreamType::Buffered
    } else {
        StreamType::Realtime
    };

    let asc = if audio_format.codec == AudioCodec::Alac {
        Some(AlacEncoder::new(audio_format.clone())?.magic_cookie())
    } else {
        None
    };

    let config = StreamConfig {
        stream_type,
        audio_format,
        timing_protocol,
        ptp_mode,
        latency_min: 22050, // 500ms; matches the previously working AirPlay 2 setup
        latency_max: 88200, // ~2s
        supports_dynamic_stream_id: true,
        asc,
    };

    let default_features = Features::from_raw(0x445F8A00_0801C340);

    if use_airplay2 || pin_arg.is_some() {
        println!("\n--- Connecting (AirPlay 2 to {} devices) ---", ips.len());
        let mut conns = Vec::new();
        for (idx, target_ip) in ips.iter().enumerate() {
            // A stable target ID is required to reuse the saved pairing identity.
            // Keep an explicitly supplied ID for the normal one-target CLI path,
            // and derive one from each address when multiple targets are supplied.
            let dev_id_str = if ips.len() == 1 {
                device_id_str.clone()
            } else {
                match target_ip {
                    IpAddr::V4(v4) => {
                        let octets = v4.octets();
                        format!(
                            "{:02X}:{:02X}:{:02X}:{:02X}:00:00",
                            octets[0], octets[1], octets[2], octets[3]
                        )
                    }
                    IpAddr::V6(v6) => {
                        let segments = v6.segments();
                        format!(
                            "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
                            (segments[0] >> 8) as u8,
                            segments[0] as u8,
                            (segments[1] >> 8) as u8,
                            segments[1] as u8,
                            (segments[2] >> 8) as u8,
                            segments[2] as u8
                        )
                    }
                }
            };
            let dev_id = DeviceId::from_mac_string(&dev_id_str)?;
            let dev = Device {
                id: dev_id,
                name: format!("AirPlay Target {}", idx + 1),
                model: "Unknown".to_string(),
                manufacturer: None,
                serial_number: None,
                addresses: vec![*target_ip],
                port,
                features: default_features,
                required_sender_features: None,
                public_key: None,
                source_version: Default::default(),
                firmware_version: None,
                os_version: None,
                protocol_version: None,
                requires_password: false,
                status_flags: 0,
                access_control: None,
                pairing_identity: None,
                system_pairing_identity: None,
                bluetooth_address: None,
                homekit_home_id: None,
                group_id: None,
                is_group_leader: false,
                group_public_name: None,
                group_contains_discoverable_leader: false,
                home_group_id: None,
                household_id: None,
                parent_group_id: None,
                parent_group_contains_discoverable_leader: false,
                tight_sync_id: None,
                raop_port: None,
                raop_encryption_types: None,
                raop_codecs: None,
                raop_transport: None,
                raop_metadata_types: None,
                raop_digest_auth: false,
                vodka_version: None,
            };

            println!("Connecting to {} ({:?})...", target_ip, dev_id_str);
            let mut target_config = config.clone();
            if ptp_targets.contains(target_ip) || (use_ptp && ptp_targets.is_empty()) {
                target_config.timing_protocol = TimingProtocol::Ptp;
                target_config.ptp_mode = PtpMode::Master;
                println!("Using PTP timing for {}", target_ip);
            }
            let mut conn = Connection::connect_auto(dev, target_config, "3939").await?;
            if render_delay_ms > 0 {
                conn.set_render_delay_ms(render_delay_ms);
            }
            conns.push(conn);
        }

        // Complete RTSP and Timing Setup for all connections
        let ptp_indices: Vec<usize> = conns
            .iter()
            .enumerate()
            .filter(|(_, conn)| conn.stream_config().timing_protocol == TimingProtocol::Ptp)
            .map(|(i, _)| i)
            .collect();

        if !ptp_indices.is_empty() {
            let ptp_target_ips: Vec<std::net::IpAddr> = ptp_indices.iter().map(|&i| ips[i]).collect();
            let primary_ptp_idx = ptp_indices[0];

            if ptp_master {
                println!(
                    "Setting up speaker {} ({}) as PTP master for {} PTP speaker(s)...",
                    primary_ptp_idx + 1,
                    ips[primary_ptp_idx],
                    ptp_target_ips.len()
                );
                conns[primary_ptp_idx].setup_as_ptp_master(&ptp_target_ips).await?;
            } else {
                println!("Setting up speaker {} ({})...", primary_ptp_idx + 1, ips[primary_ptp_idx]);
                conns[primary_ptp_idx].setup().await?;
            }
            let ptp_clock_id = conns[primary_ptp_idx].ptp_master_clock_id().unwrap_or([0u8; 8]);
            let timing_offset = conns[primary_ptp_idx].timing_offset().unwrap_or_default();
            let timing_rx = conns[primary_ptp_idx].timing_rx();
            println!("Primary PTP setup done, clock ID: {:02x?}", ptp_clock_id);

            for (i, conn) in conns.iter_mut().enumerate() {
                if i == primary_ptp_idx {
                    continue;
                }
                println!("Setting up speaker {} (IP: {})...", i + 1, ips[i]);
                if conn.stream_config().timing_protocol == TimingProtocol::Ptp {
                    if let Some(ref rx) = timing_rx {
                        conn.setup_for_group(ptp_clock_id, timing_offset, rx.clone()).await?;
                    } else {
                        conn.setup().await?;
                    }
                } else {
                    conn.setup().await?;
                }
            }
        } else {
            for conn in conns.iter_mut() {
                conn.setup().await?;
            }
        }
        println!("\n--- Starting playback on all speakers ---");
        let dec = AudioDecoder::open(audio_path)?;
        if conns.len() == 1 {
            conns[0].start_streaming(dec).await?;
        } else {
            let (first, rest) = conns.split_at_mut(1);
            first[0].start_group_streaming(rest, dec).await?;
        }

        let artwork_bytes = if let Some(path) = artwork_path.as_ref() {
            std::fs::read(path).ok()
        } else {
            None
        };

        for (idx, conn) in conns.iter_mut().enumerate() {
            let _ = conn
                .send_metadata(&metadata_title, &metadata_album, &metadata_artist)
                .await;
            if let Some(ref artwork) = artwork_bytes {
                let _ = conn.send_artwork(artwork.clone(), "image/jpeg").await;
            }
            let progress_duration = metadata_duration.unwrap_or(duration_secs);
            let _ = conn.send_progress(progress_duration).await;
            if let Some(vol) = initial_volume {
                let _ = conn.set_volume(vol).await;
            }
            println!("Speaker {} ({}) streaming started!", idx + 1, ips[idx]);
        }

        let mut feedback_counter = 0u32;
        let mut next_volume_step = 0usize;
        let mut current_duration_secs = metadata_duration.unwrap_or(duration_secs);
        let source_test_started = Instant::now();
        let mut source_test_paused = false;
        let mut source_test_resumed = false;
        let mut stop_requested = false;
        loop {
            tokio::time::sleep(Duration::from_millis(75)).await;
            feedback_counter += 1;
            let pos = conns[0].playback_position();
            let state = conns[0].playback_state();
            if feedback_counter % 27 == 0 {
                println!("Position: {:.1}s, State: {:?}", pos, state);
                let progress_duration = current_duration_secs;
                for conn in conns.iter_mut() {
                    let _ = conn.send_progress(progress_duration).await;
                }
            }

            while let Ok(command) = source_commands.try_recv() {
                tracing::info!("Applying source command: {:?}", command);
                match command {
                    SourceCommand::Pause => {
                        for conn in &mut conns {
                            conn.pause().await?;
                        }
                    }
                    SourceCommand::Resume => {
                        for conn in &mut conns {
                            conn.resume().await?;
                        }
                    }
                    SourceCommand::Volume { target, value } => {
                        for (index, conn) in conns.iter_mut().enumerate() {
                            if target.is_none() || target == Some(ips[index]) {
                                conn.set_volume(value).await?;
                            }
                        }
                    }
                    SourceCommand::Track(payload) => {
                        println!("TRACK_TRANSITION: Switching to '{}' by '{}'", payload.title, payload.artist);
                        let _ = std::io::Write::flush(&mut std::io::stdout());
                        let artwork_bytes = if let Some(ref art_path) = payload.artwork_path {
                            std::fs::read(art_path).ok()
                        } else {
                            None
                        };

                        for conn in &mut conns {
                            match AudioDecoder::open(&payload.path) {
                                Ok(dec) => {
                                    if let Err(e) = conn.change_track(
                                        dec,
                                        &payload.title,
                                        &payload.album,
                                        &payload.artist,
                                        payload.duration,
                                        artwork_bytes.clone(),
                                    ).await {
                                        tracing::warn!("Failed to change track on speaker: {}", e);
                                    }
                                }
                                Err(e) => tracing::error!("Failed to open audio decoder for {}: {}", payload.path, e),
                            }
                        }
                        current_duration_secs = payload.duration;

                        // Update DACP state
                        {
                            let mut state_guard = dacp_state.write().await;
                            state_guard.title = payload.title.clone();
                            state_guard.artist = payload.artist.clone();
                            state_guard.album = payload.album.clone();
                            state_guard.duration_ms = (payload.duration * 1000.0) as u32;
                            state_guard.position_ms = 0;
                            state_guard.state = airplay_client::PlaybackState::Playing;
                        }
                    }
                    SourceCommand::Stop => {
                        stop_requested = true;
                    }
                }
            }

            if stop_requested {
                println!("Source requested shutdown");
                break;
            }

            let mut airplay_command = None;
            for (index, conn) in conns.iter_mut().enumerate() {
                let event_data = conn.poll_event_data()?;
                if !event_data.is_empty() {
                    if handle_remote_events {
                        if let Some(command) = airplay_event_command(&event_data) {
                            airplay_command = Some(command);
                        }
                    }
                    println!(
                        "EVENT DATA speaker {} ({} bytes): hex={:02x?} text={}",
                        index + 1,
                        event_data.len(),
                        event_data,
                        String::from_utf8_lossy(&event_data)
                    );
                }
            }

            if let Some(command) = airplay_command {
                println!("REMOTE_EVENT: {:?}", command);
                let _ = std::io::Write::flush(&mut std::io::stdout());
                match command {
                    DacpCommand::Pause => {
                        for conn in &mut conns {
                            conn.pause_from_remote().await?;
                        }
                    }
                    DacpCommand::Play => {
                        for conn in &mut conns {
                            conn.resume_from_remote().await?;
                        }
                    }
                    DacpCommand::Next => {
                        break;
                    }
                    DacpCommand::Prev => {
                        break;
                    }
                    DacpCommand::PlayPause => unreachable!(),
                }
            }

            if source_pause_test
                && !source_test_paused
                && source_test_started.elapsed() >= Duration::from_secs(8)
            {
                println!("SOURCE TEST: pausing all speakers");
                for conn in &mut conns {
                    conn.pause().await?;
                }
                source_test_paused = true;
            }
            if source_pause_test
                && source_test_paused
                && !source_test_resumed
                && source_test_started.elapsed() >= Duration::from_secs(13)
            {
                println!("SOURCE TEST: resuming all speakers");
                for conn in &mut conns {
                    conn.resume().await?;
                }
                source_test_resumed = true;
            }

            while let Some(&(step_time, step_volume)) = volume_steps.get(next_volume_step) {
                if pos < step_time {
                    break;
                }
                println!("Applying volume step at {:.1}s: {:.2}", pos, step_volume);
                for conn in &mut conns {
                    conn.set_volume(step_volume).await?;
                }
                next_volume_step += 1;
            }

            {
                let mut state_guard = dacp_state.write().await;
                state_guard.position_ms = (pos * 1000.0) as u32;
                state_guard.state = conns[0].playback_state();
            }

            if let Some(commands) = dacp_commands.as_mut() {
                while let Ok(command) = commands.try_recv() {
                    let command = match command {
                        DacpCommand::PlayPause => {
                            if conns[0].playback_state() == airplay_client::PlaybackState::Paused {
                                DacpCommand::Play
                            } else {
                                DacpCommand::Pause
                            }
                        }
                        command => command,
                    };
                    println!("REMOTE_EVENT: {:?}", command);
                    let _ = std::io::Write::flush(&mut std::io::stdout());
                    match command {
                        DacpCommand::Pause => {
                            for conn in &mut conns {
                                conn.pause().await?;
                            }
                        }
                        DacpCommand::Play => {
                            for conn in &mut conns {
                                conn.resume().await?;
                            }
                        }
                        DacpCommand::Next => {
                            break;
                        }
                        DacpCommand::Prev => {
                            break;
                        }
                        DacpCommand::PlayPause => unreachable!(),
                    }
                }
            }

            if feedback_counter % 30 == 0 {
                for conn in conns.iter_mut() {
                    let _ = conn.send_feedback().await;
                }
            }

            if current_duration_secs > 0.0 && pos >= current_duration_secs - 0.5 {
                println!("\nReached end of audio, stopping...");
                break;
            }
        }

        println!("\n--- Stopping all speakers ---");
        for mut conn in conns {
            let _ = conn.stop().await;
            let _ = conn.disconnect().await;
        }
        drop(dacp_daemon);
        std::process::exit(0);
    } else {
        // AirPlay 1 / RAOP path: no pairing, plaintext RTSP, AES-CBC audio
        println!("\n--- Connecting (RAOP) ---");
        let dev_id = DeviceId::from_mac_string(&device_id_str)?;
        let device = Device {
            id: dev_id,
            name: "AirPlay Device".to_string(),
            model: "Unknown".to_string(),
            manufacturer: None,
            serial_number: None,
            addresses: vec![ips[0]],
            port,
            features: default_features,
            required_sender_features: None,
            public_key: None,
            source_version: Default::default(),
            firmware_version: None,
            os_version: None,
            protocol_version: None,
            requires_password: false,
            status_flags: 0,
            access_control: None,
            pairing_identity: None,
            system_pairing_identity: None,
            bluetooth_address: None,
            homekit_home_id: None,
            group_id: None,
            is_group_leader: false,
            group_public_name: None,
            group_contains_discoverable_leader: false,
            home_group_id: None,
            household_id: None,
            parent_group_id: None,
            parent_group_contains_discoverable_leader: false,
            tight_sync_id: None,
            raop_port: None,
            raop_encryption_types: None,
            raop_codecs: None,
            raop_transport: None,
            raop_metadata_types: None,
            raop_digest_auth: false,
            vodka_version: None,
        };
        let mut conn = RaopConnection::connect(device, config).await?;
        if render_delay_ms > 0 {
            conn.set_render_delay_ms(render_delay_ms);
        }
        println!("Connected!");

        println!("\n--- Setting up stream ---");
        conn.setup().await?;
        println!("Setup complete!");

        println!("\n--- Starting playback ---");
        conn.start_streaming(decoder).await?;
        println!("Playing audio...");

        let mut feedback_counter = 0u32;
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            let pos = conn.playback_position();
            let state = conn.playback_state();
            println!("Position: {:.1}s, State: {:?}", pos, state);

            feedback_counter += 1;
            if feedback_counter % 2 == 0 {
                if let Err(e) = conn.send_feedback().await {
                    tracing::warn!("Feedback failed: {}", e);
                }
            }

            if duration_secs > 0.0 && pos >= duration_secs - 0.5 {
                println!("\nReached end of audio, stopping...");
                break;
            }
        }

        println!("\n--- Stopping ---");
        conn.stop().await?;
        conn.disconnect().await?;
    }

    println!("Done!");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{parse_source_command, SourceCommand};
    use std::net::{IpAddr, Ipv4Addr};

    #[test]
    fn parses_lifecycle_commands() {
        assert!(matches!(
            parse_source_command("pause"),
            Some(SourceCommand::Pause)
        ));
        assert!(matches!(
            parse_source_command("resume"),
            Some(SourceCommand::Resume)
        ));
        assert!(matches!(
            parse_source_command("stop"),
            Some(SourceCommand::Stop)
        ));
    }

    #[test]
    fn parses_global_and_targeted_volume() {
        assert!(matches!(
            parse_source_command("volume 0.42"),
            Some(SourceCommand::Volume { target: None, value }) if (value - 0.42).abs() < f32::EPSILON
        ));
        assert!(matches!(
            parse_source_command("volume 192.168.120.111 0.37"),
            Some(SourceCommand::Volume {
                target: Some(IpAddr::V4(address)),
                value,
            }) if address == Ipv4Addr::new(192, 168, 120, 111) && (value - 0.37).abs() < f32::EPSILON
        ));
    }
}
