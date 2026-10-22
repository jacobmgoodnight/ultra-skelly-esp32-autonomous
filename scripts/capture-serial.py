"""Read UART bytes without decoding or issuing controller commands.
Install optional pyserial first; close other terminals. Opening USB can reset boards.
"""
import argparse
import json
import time
from pathlib import Path

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',required=True,help='Explicit port, e.g. COM3 or /dev/ttyUSB0')
    parser.add_argument('--seconds',type=int,default=240)
    parser.add_argument('--output',type=Path,required=True,help='New .bin file; existing files are never overwritten')
    args=parser.parse_args()
    if not 1<=args.seconds<=86400:parser.error('--seconds must be 1–86400')
    try:import serial
    except ImportError:raise SystemExit('Install the optional dependency: python -m pip install pyserial==3.5')
    started=time.monotonic();total=0
    # Exclusive creation avoids silently replacing a previous diagnostic capture.
    with args.output.open('xb') as target:
        port=serial.Serial(port=None,baudrate=115200,timeout=0.25)
        port.port=args.port;port.dtr=False;port.rts=False
        try:
            port.open()
            while time.monotonic()-started<args.seconds:
                chunk=port.read(min(max(port.in_waiting,1),4096))
                if chunk:target.write(chunk);total+=len(chunk)
                if total>=64*1024*1024:break
        except KeyboardInterrupt:pass
        finally:port.close()
    print(json.dumps({'bytes':total,'file':str(args.output),'elapsedSeconds':round(time.monotonic()-started,2)}))
if __name__=='__main__':main()
