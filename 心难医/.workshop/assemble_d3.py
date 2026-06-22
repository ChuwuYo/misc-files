# -*- coding: utf-8 -*-
import json,os,sys,re,glob
W=os.path.dirname(os.path.abspath(__file__)); X=os.path.dirname(W)
ROOT=os.path.join(X,"兼济义诊-20260925")
D=json.loads(open(os.path.join(W,"d3_doctors50.json"),encoding="utf-8").read())
EV=D["event"]; DOCS={d["idx"]:d for d in D["docs"]}
PREP=json.loads(open(os.path.join(W,"d3_prepared.json"),encoding="utf-8").read())
BYNO=json.loads(open(os.path.join(W,"d3_cases_byno.json"),encoding="utf-8").read())
SALV=json.loads(open(os.path.join(W,"d3_cases_salvaged.json"),encoding="utf-8").read())
NB={c["idx"]:c["content"] for c in SALV if c["kind"]=="本"}
HEADLINE=re.compile(r'^[ \t]*#{1,4}[ \t]*(?:编号|序号|病例|案例)?[ \t]*(\d{4})[ \t]*·[ \t]*(.*)$')
def norm_case(no,seg):
    lines=seg.split("\n")
    m=HEADLINE.match(lines[0])
    if m: lines[0]="## %s · %s"%(m.group(1),m.group(2).strip())
    txt="\n".join(lines).strip()
    txt=txt.replace("�","")
    txt=re.sub(r'(?m)^\s*(written to|file path|the file has been written|here is the deliverable).*$','',txt,flags=re.I).strip()
    return txt

def folder(i):
    d=DOCS[i]; return os.path.join(ROOT,"%02d-%s-%s"%(i,d["name"],d["slug"]))

def assemble(idxs):
    report=[]
    for i in idxs:
        room=PREP.get(str(i))
        if not room: report.append((i,"未prep")); continue
        d=DOCS[i]; fold=folder(i); os.makedirs(fold,exist_ok=True)
        keep=set()
        # 清旧册/垃圾（保留 新医生入职小本本.md）
        # 写册
        wrote=0; miss=[]
        for c,nos in enumerate(room["cefen"],1):
            if not all(n in BYNO for n in nos): miss.append(c); continue
            body="\n\n---\n\n".join(norm_case(n,BYNO[n]) for n in nos)
            start,end=nos[0],nos[-1]
            hdr=("# 心难医 · 兼济公益义诊·第三日·中秋特别场 · 第%d诊室 · 第%d册 · %s–%s\n"
                 "> 2026-09-25 周五·中秋节当天 · 总督导 沈砚清\n"
                 "> 诊室：第%d诊室 · 主治：%s（%s）\n"
                 "> 本册 10 例（深档 1 + 简档 9）· 取向：%s\n"
                 "> 当日轴：%s\n\n---\n\n")%(i,c,start,end,i,d["name"],d["title"],d["orientation"],EV["theme"])
            fn="%02d-%s-%s.md"%(c,start,end); keep.add(fn)
            open(os.path.join(fold,fn),"w",encoding="utf-8").write(hdr+body+"\n"); wrote+=1
        # 夜记（老十位）/ 入职小本本（新四十位）
        if i<=10:
            keep.add("小本本-第三日·中秋夜.md")
            if i in NB:
                t=NB[i].replace("�","")
                k=t.find("#"); t=t[k:] if k>=0 else t
                open(os.path.join(fold,"小本本-第三日·中秋夜.md"),"w",encoding="utf-8").write(t.strip()+"\n")
        else:
            keep.add("小本本.md")
        keep.add("00-本室目录.md")
        # 删除不在 keep 的 .md（agent 乱写的垃圾）
        for fp in glob.glob(os.path.join(fold,"*.md")):
            if os.path.basename(fp) not in keep: os.remove(fp)
        report.append((i,d["name"],"%d/10册"%wrote,("缺册:"+str(miss)) if miss else "满",("夜记✓" if (i<=10 and i in NB) else ("夜记缺" if i<=10 else "入职本"))))
    for r in report: print(r)

if __name__=="__main__":
    idxs=[int(x) for x in sys.argv[1].split(",")] if len(sys.argv)>1 else sorted(int(k) for k in PREP)
    assemble(idxs)
