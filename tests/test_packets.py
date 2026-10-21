"""Verify CRC algorithm against three on-device-observed packets.
Run: python tests/test_packets.py
"""

def crc8(data):
    crc = 0
    for b in data:
        x = crc ^ b
        for _ in range(8):
            x = ((x >> 1) ^ 0x8C) if (x & 1) else (x >> 1)
        crc = x & 0xFF
    return crc


def main():
    vectors = [
        ([0xAA, 0xCA, 0x01] + [0]*7, 0x51, "head"),
        ([0xAA, 0xCA, 0x04] + [0]*7, 0x07, "torso"),
        ([0xAA, 0xC6, 0x00, 0x0C, 0x01] + [0]*5, 0xDF, "audio file 12"),
    ]
    for packet, expected, label in vectors:
        result=crc8(packet)
        assert result == expected, f"{label}: got {result:02X}, expected {expected:02X}"
        print(f"PASS {label}: CRC {result:02X}")
    # Live torso/head light bytes reconstructed from upstream F2/F3/F4.
    # Protocol-derived vectors; initial colors worked, restoration is unconfirmed.
    lights = [
        ([0xAA,0xF2,0,1]+[0]*6, 0xA5, "torso static F2"),
        ([0xAA,0xF2,1,1]+[0]*7, 0x34, "head static F2"),
        ([0xAA,0xF3,0,180]+[0]*6, 0x4B, "torso brightness F3"),
        ([0xAA,0xF3,1,180]+[0]*6, 0x08, "head brightness F3"),
        ([0xAA,0xF4,0,255,0,0]+[0]*6, 0xD3, "torso red F4"),
        ([0xAA,0xF4,1,255,96,0]+[0]*6, 0xFC, "head amber F4"),
    ]
    for packet, expected, label in lights:
        result = crc8(packet)
        assert result == expected, f"{label}: got {result:02X}, expected {expected:02X}"
        print(f"PASS derived {label}: length={len(packet)+1} CRC={result:02X}")
    eye = [0xAA, 0xF9, 0x02] + [0]*7
    print(f"Live eye icon #2 packet (live eye changes physically verified): "+' '.join(f'{b:02X}' for b in eye + [crc8(eye)]))


if __name__ == '__main__':
    main()
