from ytmusicapi import setup

with open('headers_raw.txt', 'r', encoding='utf-8') as f:
    raw_headers = f.read()

# Setup reads the raw text and converts it to browser.json format
setup(filepath="browser.json", headers_raw=raw_headers)
print("browser.json generated successfully using ytmusicapi.setup()")
