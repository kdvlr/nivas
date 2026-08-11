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
use std::net::IpAddr;
use std::time::Duration;

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
        .with_max_level(tracing::Level::DEBUG)
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
        std::process::exit(1);
    }

    let ips: Vec<IpAddr> = args[1]
        .split(',')
        .map(|s| s.trim().parse().expect("Invalid IP address"))
        .collect();
    let port: u16 = args[2].parse()?;
    let audio_path = &args[3];

    // Parse optional protocol flags (default: airplay1/RAOP with NTP)
    let use_airplay2 = args.iter().any(|a| a == "--airplay2");
    let use_ptp = args.iter().any(|a| a == "--ptp");
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

    let config = StreamConfig {
        stream_type,
        audio_format,
        timing_protocol,
        ptp_mode,
        latency_min: 11025, // ~250ms
        latency_max: 88200, // ~2s
        supports_dynamic_stream_id: true,
        asc: None,
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
            let mut conn = Connection::connect_auto(dev, config.clone(), "3939").await?;
            if render_delay_ms > 0 {
                conn.set_render_delay_ms(render_delay_ms);
            }
            conn.setup().await?;
            if let Some(vol) = initial_volume {
                let _ = conn.set_volume(vol).await;
            }
            conns.push(conn);
        }
        println!("All {} devices connected and setup complete!", conns.len());

        println!("\n--- Starting playback on all speakers ---");
        for (idx, conn) in conns.iter_mut().enumerate() {
            let dec = AudioDecoder::open(audio_path)?;
            conn.start_streaming(dec).await?;
            if let Some(vol) = initial_volume {
                let _ = conn.set_volume(vol).await;
            }
            let _ = conn
                .send_metadata("YouTube Music", "Nivas", "Nivas AirPlay")
                .await;
            println!("Speaker {} ({}) streaming started!", idx + 1, ips[idx]);
        }

        let mut feedback_counter = 0u32;
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            let pos = conns[0].playback_position();
            let state = conns[0].playback_state();
            println!("Position: {:.1}s, State: {:?}", pos, state);

            feedback_counter += 1;
            if feedback_counter % 2 == 0 {
                for conn in conns.iter_mut() {
                    let _ = conn.send_feedback().await;
                }
            }

            if duration_secs > 0.0 && pos >= duration_secs - 0.5 {
                println!("\nReached end of audio, stopping...");
                break;
            }
        }

        println!("\n--- Stopping all speakers ---");
        for mut conn in conns {
            let _ = conn.stop().await;
            let _ = conn.disconnect().await;
        }
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
