import pytest
from app.services.airplay import AirPlayService, AirPlayDevice

def test_airplay_device_management():
    service = AirPlayService()
    dev = AirPlayDevice("living_room", "Living Room Speaker", "1920.168.1.50", 7000, "HomePod")
    service.devices["living_room"] = dev
    
    devices = service.get_devices()
    assert len(devices) == 1
    assert devices[0]["name"] == "Living Room Speaker"
    
    # Toggle selection
    updated_devices = service.toggle_device_selection("living_room", True)
    assert "living_room" in service.active_targets
    assert updated_devices[0]["isSelected"] is True
    
    # Set volume
    updated_dev = service.set_device_volume("living_room", 85)
    assert updated_dev["volume"] == 85

def test_airplay_master_volume():
    service = AirPlayService()
    dev1 = AirPlayDevice("dev1", "Speaker 1", "192.168.1.10", 7000)
    dev2 = AirPlayDevice("dev2", "Speaker 2", "192.168.1.11", 7000)
    service.devices["dev1"] = dev1
    service.devices["dev2"] = dev2
    
    service.toggle_device_selection("dev1", True)
    service.toggle_device_selection("dev2", True)
    
    service.set_master_volume(45)
    assert service.master_volume == 45
    assert dev1.volume == 45
    assert dev2.volume == 45
