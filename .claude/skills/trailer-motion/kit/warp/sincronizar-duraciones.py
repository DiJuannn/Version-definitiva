import json,re
c=json.loads(open("assets/cues.js").read()[len("window.CUES="):].rstrip().rstrip(";"))
K=c["K"]; W=c["warp"]
def R(s):
    for w in W:
        if s < w["s1"]+1e-9 or w is W[-1]: return w["r0"]+(max(s,w["s0"])-w["s0"])*K
secs={"secA":(0,6),"secB":(6,7),"secC":(13,7),"secD":(20,16),"logoSting":(1.5,0.5)}
real={k:(round(R(a),4),round(R(a+d)-R(a),4)) for k,(a,d) in secs.items()}
print(real,c["realDur"])
h=open("index.html").read()
for id,(st,du) in real.items():
    h,n=re.subn(rf'(data-composition-id="{id}"[^>]*?)data-start="[\d.]+" data-duration="[\d.]+"',rf'\g<1>data-start="{st}" data-duration="{du}"',h); assert n==1,id
h,n=re.subn(r'(id="(?:root|banda)"[^>]*?data-start="0" data-duration=")[\d.]+',rf'\g<1>{c["realDur"]}',h); assert n==2
open("index.html","w").write(h)
files={"secA":"secA","secB":"secB","secC":"secC","secD":"secD","logoSting":"logo-sting"}
for id,(st,du) in real.items():
    f=f"compositions/{files[id]}.html"; s=open(f).read()
    s,n=re.subn(r'(data-composition-id="%s" data-width="1080" data-height="1920" data-duration=")[\d.]+'%id, rf'\g<1>{du}', s); assert n==1,id
    open(f,"w").write(s)
