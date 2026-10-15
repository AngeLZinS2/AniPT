"""Prepare the local, silent onboarding mosaic from public official trailers.

Preparation-only dependencies: yt-dlp and imageio-ffmpeg (not shipped in AniBR).
Original downloads stay in ignored .media-work; only the derived MP4/poster ship.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import subprocess
import sys
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/media'))
import imageio_ffmpeg
import yt_dlp

WORK = ROOT / '.media-work'
OUT = ROOT / 'frontend/public/media'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
# name, YouTube ID, official channel ID, source start in seconds
SOURCES = [
    ('Solo Leveling', 'HkIKAnwLZCw', 'UC6pGDc4bFGD1_36IKv3FnYg', 26),
    ('Frieren', 'Iwr1aLEDpe4', 'UC6pGDc4bFGD1_36IKv3FnYg', 16),
    ('DAN DA DAN', 'NRxTXed7I7k', 'UCBSs9x2KzSLhyyA9IKyt4YA', 12),
    ('Demon Slayer', '6vMuWuWlW4I', 'UCDb0peSmF5rLX7BvuTcJfCw', 24),
    ('Chainsaw Man', 'v4yLeNt-kCU', 'UCjfAEJZdfbIjVHdo5yODfyQ', 17),
    ('Jujutsu Kaisen', 'RIyb52EMx8c', 'UC14Yc2Qv92DMuyNRlHvpo2Q', 28),
    ('Attack on Titan', 'LHtdKWJdif4', 'UC6CSkrMJkDjLrtPiNXxPXxw', 2),
    ('My Hero Academia', 'AhqVltWDqFA', 'UC14Yc2Qv92DMuyNRlHvpo2Q', 17),
    ('Fate/strange Fake', 'https://fate-strange-fake.com/assets/img/page/top/mainvisual/aside/pv_anime_2.mp4', None, 0),
]

def run(arguments):
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *arguments], check=True)

def prepare(index_source):
    index, (name, source_id, channel, start) = index_source
    direct = source_id.startswith('https://')
    video_id = 'fate-official-pv' if direct else source_id
    url = source_id if direct else f'https://www.youtube.com/watch?v={video_id}'
    metadata = WORK / f'{video_id}.json'
    source = WORK / f'{video_id}.mp4'
    if source.exists() and metadata.exists():
        record = json.loads(metadata.read_text(encoding='utf-8'))
    elif direct:
        with urlopen(url, timeout=30) as response:
            if response.headers.get_content_type() != 'video/mp4':
                raise RuntimeError('Official source is not an MP4')
            source.write_bytes(response.read())
        reader = imageio_ffmpeg.read_frames(str(source))
        details = next(reader)
        reader.close()
        record = {'anime': name, 'url': url, 'channel': 'fate-strange-fake.com',
                  'width': details['size'][0], 'height': details['size'][1],
                  'start': start, 'duration_used': 16.5}
        metadata.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    else:
        def official_only(info, *, incomplete=False):
            actual = info.get('channel_id')
            if actual and actual != channel:
                return 'Channel differs from the verified official source'
        options = {
            'quiet': True, 'no_warnings': True, 'noprogress': True,
            'cachedir': False, 'noplaylist': True,
            'js_runtimes': {'node': {}}, 'match_filter': official_only,
            'format': 'bv[vcodec^=avc1][height<=1080][ext=mp4]/bv[height<=1080][ext=mp4]',
            'outtmpl': str(WORK / f'{video_id}.%(ext)s'),
        }
        with yt_dlp.YoutubeDL(options) as downloader:
            info = downloader.extract_info(url, download=True)
        if not info or info.get('channel_id') != channel or not source.exists():
            raise RuntimeError(f'Official video not downloaded: {name}')
        record = {key: info.get(key) for key in ('id', 'title', 'channel', 'channel_id', 'width', 'height', 'duration')}
        record.update(anime=name, url=url, start=start, duration_used=16.5)
        metadata.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    tile = WORK / f'tile-{index}.mp4'
    # The last half-second blends into the first half-second. Rotate that blend
    # to the end, so the loop joins at source time .5 without a black frame.
    filters = (
        '[0:v]fps=24,scale=640:360:force_original_aspect_ratio=increase,'
        'crop=640:360,setsar=1,split=3[body][tail][head];'
        '[body]trim=start=0.5:end=16,setpts=PTS-STARTPTS,fps=24,settb=AVTB[b];'
        '[tail]trim=start=16:end=16.5,setpts=PTS-STARTPTS,fps=24,settb=AVTB[t];'
        '[head]trim=start=0:end=0.5,setpts=PTS-STARTPTS,fps=24,settb=AVTB[h];'
        '[t][h]xfade=transition=fade:duration=0.5:offset=0[seam];'
        '[b][seam]concat=n=2:v=1:a=0[out]'
    )
    run(['-stream_loop', '-1', '-ss', str(start), '-t', '16.5', '-i', str(source), '-filter_complex', filters,
         '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
         '-pix_fmt', 'yuv420p', '-threads', '2', str(tile)])
    print(f'Prepared {index + 1}/9: {name} ({record["height"]}p source)', flush=True)
    return record

def main():
    WORK.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as executor:
        records = list(executor.map(prepare, enumerate(SOURCES)))
    inputs = [argument for index in range(9) for argument in ('-i', str(WORK / f'tile-{index}.mp4'))]
    layout = '0_0|640_0|1280_0|0_360|640_360|1280_360|0_720|640_720|1280_720'
    mosaic = OUT / 'welcome-mosaic.mp4'
    run([*inputs, '-filter_complex', f'{"".join(f"[{i}:v]" for i in range(9))}xstack=inputs=9:layout={layout}:shortest=1[out]',
         '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
         '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '4', str(mosaic)])
    run(['-ss', '2', '-i', str(mosaic), '-frames:v', '1', '-q:v', '3', str(OUT / 'welcome-mosaic.jpg')])
    (ROOT / 'docs/WELCOME_MEDIA_SOURCES.json').write_text(json.dumps({
        'output': 'frontend/public/media/welcome-mosaic.mp4',
        'width': 1920, 'height': 1080, 'fps': 24, 'audio': False,
        'layout': '3 x 3', 'sha256': hashlib.sha256(mosaic.read_bytes()).hexdigest(),
        'sources': records,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Mosaic: {mosaic.stat().st_size / 1024 / 1024:.2f} MiB', flush=True)

if __name__ == '__main__':
    main()
