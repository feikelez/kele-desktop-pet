import wave
import os
import re
import struct

wav_dir = r'E:\SteamLibrary\steamapps\common\Stardew Valley\Content\XACT'
xsb_path = os.path.join(wav_dir, 'Sound Bank.xsb')

# Parse XSB to find cue-to-wave mapping
with open(xsb_path, 'rb') as f:
    xsb_data = f.read()

# Extract all strings and their offsets
strings = []
pos = 0
while pos < len(xsb_data):
    if 32 <= xsb_data[pos] < 127:
        start = pos
        while pos < len(xsb_data) and 32 <= xsb_data[pos] < 127:
            pos += 1
        if pos - start >= 2:
            s = xsb_data[start:pos].decode('ascii')
            strings.append((start, s))
        pos += 1
    else:
        pos += 1

# Find the string table region
string_offsets = {}
for off, s in strings:
    string_offsets[off] = s

# Search for cue entries: a 2-byte name_offset that points into the string table
# followed by other fields
cue_entries = []
cat_wave_index = None

for off in range(0x100, len(xsb_data) - 8, 2):
    name_off = struct.unpack_from('<H', xsb_data, off)[0]
    if name_off in string_offsets:
        name = string_offsets[name_off]
        if name == 'cat':
            # Found it! Read surrounding fields
            flags = struct.unpack_from('<H', xsb_data, off + 2)[0]
            print(f'cat cue entry at XSB offset {hex(off)}:')
            print(f'  name_offset: {hex(name_off)} -> "{name}"')
            print(f'  flags: {hex(flags)}')
            # Dump more bytes
            for i in range(0, 16, 2):
                val = struct.unpack_from('<H', xsb_data, off + i)[0]
                print(f'  +{i}: {hex(val)} ({val})')
            cat_wave_index = flags  #猜测: flags 可能包含 wave index

if cat_wave_index is not None:
    print(f'\nPossible wave index for cat: {cat_wave_index}')
else:
    print('\ncat cue entry not found via string table search')

# Also list all cue names and their entries
print('\n--- All cue entries found ---')
seen = set()
for off in range(0x100, len(xsb_data) - 8, 2):
    name_off = struct.unpack_from('<H', xsb_data, off)[0]
    if name_off in string_offsets:
        name = string_offsets[name_off]
        if name not in seen and len(name) >= 2:
            seen.add(name)
            flags = struct.unpack_from('<H', xsb_data, off + 2)[0]
            print(f'  {name:30s} at {hex(off)} flags={hex(flags)} ({flags})')
