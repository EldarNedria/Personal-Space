from ytmusicapi import YTMusic
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    print("Attempting to authenticate...")
    yt = YTMusic('browser.json')
    playlists = yt.get_library_playlists(limit=3)
    print("\nAuthentication Successful!")
    print(f"Found {len(playlists)} playlists.")
    if playlists:
        print(f"First playlist: {playlists[0].get('title', 'Unknown')}")
except Exception as e:
    print(f"\nError: {e}")
    sys.exit(1)
