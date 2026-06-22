# -*- coding: utf-8 -*-
"""第三日发车器：prep_rooms(房间列表) 去重+编号并累积存盘；gen_case_wf(房间列表,路径) 生成写册workflow；gen_roster_wf(缺失列表,路径)"""
import json,os,re,sys
W=os.path.dirname(os.path.abspath(__file__))
D=json.loads(open(os.path.join(W,"d3_doctors50.json"),encoding="utf-8").read())
EV=D["event"]; DOCS={d["idx"]:d for d in D["docs"]}
SEED=json.loads(open(os.path.join(W,"d3_seed.json"),encoding="utf-8").read())
AVOID_CANON=set('沈砚清,沈砚之,阿砚,温汀露,叶忱,伏衡远,欧翎,谢淙音,齐默,曾秋云,戴景澄,郑筠,包嘉迩,沃霁岚,单语澄,白岫青,韦砚舟,万昭弦,蓝舸宁,邵临江,步遥岸,严问初,平岱兰,屠青梧,卞迟暄,楚谙澈,房书远,路阙音,龙翰宇,顾雪莺,凌徽鸢,仇微寻,茅敬之,江默深,巫栀清,童晚秋,桓蕴风,滕窈,骆雪宜,段景渊,郁桓,凉璎,桑斐然,章珩,应澹生,沛雪渚,杭聿言,邹璧寒,蒙穗微,闻翊,殷栩之,简之窈'.split(','))|{d["name"] for d in D["docs"]}
SUF=['宁','川','禾','屿','岚','野','安','之','临','初','予','迟','言','澈','岸','棠']

STYLE = """# 档案文体规范（务必逐条遵守）
信条："档案密度 = 治疗密度。简化的档案是简化的治疗。"每例都是完整、鲜活的故事，绝非一问一答的流水账。
## 单例结构（四段，顺序固定）
1. `## 序号数字 · 姓名 · 性别 年龄 · 职业 · 一句话主诉 · 诊次/深简 · 时间段`——标题用两个井号，序号只写4位数字本身（如 `## 2001 · …`），前面不要加"编号/序号"等字。
2. `### 故事` —— 文学化叙事，写环境/身体姿态/沉默/停顿。对话用引用块：医生用本室医生姓字单字标记（如 `> 霍．"——……"`），来访用「患．」。临床观察（量表心算、命名、frame）以第一人称「我」穿插。
3. `### 评估` —— 要点列表：主诉 / 量表（真实量表+分数，按病种选：PHQ-9、GAD-7、C-SSRS、PCL-5、IES-R、EPDS、ICG-R、MoCA、AUDIT、Y-BOCS、DES、ISI、EAT-26、ASRS、HCL-32、PSQI 等）/ DSM-5 与 ICD-11 双编码 / 个案概念化 / 干预要点 / 风险（C-SSRS 结论、自伤他伤、儿童婴儿安全）/ 下一步 plan（含日期；义诊后多为转介或随访，注意 9-26~27 为假期）。
4. `### 来访身份脚注` —— 第一人称，来访自己口吻，朴素具体不术语。
5. 末行医生后记（本室医生口吻）：深档两三句，简档一句。
## 深 vs 简
- 深档：故事 1200–2200 字，8–16 轮对话，沉默与身体细节充分。
- 简档：故事 400–800 字，3–6 轮对话，仍是完整弧线（来→被听见→一个命名/落点→走），评估六项齐全但紧凑。简档不是残档。
## 临床准确（硬要求）
- 编码要对（按本室专长选用并自洽）；量表分数落在病情区间。危机/绿色通道必须有 C-SSRS 阳性细节 + 安全计划六步 + 处置去向（沈砚清/雷澍双绿色通道、精神科急诊）。
- 取向与病种匹配，遵守本室医生的取向与文风；解离/创伤不在不安全时探入记忆；进食障碍先做躯体安全（SUSS/体位性血压）；双相先问睡眠节律；自杀学严走 C-SSRS+安全计划。
## 第三日·中秋底色
2026-09-25 中秋节当天。来访是从今晚的饭桌、空屋和月亮底下直接走来的人——痛在"此刻"。外套上有家宴的油烟味；有人是当场离席来的；有人借买烟、倒垃圾的名义出的门；夜场延至月升之后。主题："%THEME%"
## 禁止
- 不写流水账、不写空话。不与既有名字重名。
- 直接从第一例 `## 2xxx · 姓名 …` 开始输出，禁止任何前言/说明/结尾总结。十例之间用单独一行 `---` 分隔。
""".replace("%THEME%",EV["theme"])

def _load(fn,default):
    p=os.path.join(W,fn)
    return json.loads(open(p,encoding="utf-8").read()) if os.path.exists(p) else default

def prep_rooms(idxs):
    """对指定房间的原始花名册做去重+编号，结果累积存 d3_prepared.json"""
    prepared=_load("d3_prepared.json",{})
    pool=set(SEED["names"])|AVOID_CANON
    for room in prepared.values():
        for p in room["patients"]: pool.add(p["name"])
    raw={r["idx"]:r for r in _load("d3_rosters_salvaged.json",[])}
    raw.update({r["idx"]:r for r in _load("d3_rosters_regen.json",[])})
    renamed=0
    for i in idxs:
        if str(i) in prepared: continue
        r=raw.get(i)
        if not r: print("室%d 无花名册，跳过"%i); continue
        pts=[dict(p) for p in r["patients"]]
        for p in pts:
            nm=p["name"]; k=0
            while nm in pool: nm=p["name"]+SUF[k%len(SUF)]; k+=1; renamed+=1
            p["name"]=nm; pool.add(nm)
        deep=[p for p in pts if p["depth"]=="深"]; simp=[p for p in pts if p["depth"]!="深"]
        while len(deep)<10 and simp: deep.append(simp.pop(0))
        while len(deep)>10: x=deep.pop(); x["depth"]="简"; simp.insert(0,x)
        deep=deep[:10]
        for p in deep: p["depth"]="深"
        cefen=[[deep[c]]+simp[c*9:c*9+9] for c in range(10)]
        pos=2000+(i-1)*100
        for block in cefen:
            for p in block: pos+=1; p["no"]="%04d"%pos
        prepared[str(i)]={"idx":i,"patients":[p for b in cefen for p in b],"cefen":[[p["no"] for p in b] for b in cefen]}
    json.dump(prepared,open(os.path.join(W,"d3_prepared.json"),"w",encoding="utf-8"),ensure_ascii=False)
    print("prep_rooms:",idxs,"去重改名",renamed,"处；已备房间:",sorted(int(k) for k in prepared))
    return prepared

def caseprompt(d,block):
    lines=["· 编号 %s（%s档）｜%s｜%s %s｜%s｜主诉：%s｜诊次：%s｜取向：%s｜编码提示：%s｜细节种子：%s"%(
        p["no"],p["depth"],p["name"],p["sex"],p["age"],p["occupation"],p["presentation"],p.get("session",""),p.get("modality",""),p.get("codeHint",""),p.get("notable","")) for p in block]
    return "\n".join([
      "你是义诊第 %d 诊室主治【%s】（%s）。性格：%s。临床文风：%s。对话标记用「%s．」（来访用「患．」）。"%(d["idx"],d["name"],d["title"],d["personality"],d["voice"],d["mark"]),
      "专长：%s。取向：%s。"%(d["specialty"],d["orientation"]),
      '义诊第三日·中秋特别场："%s"，%s %s（中秋节当天），总督导沈砚清。本室当日群像："%s"'%(EV["title"],EV["date"],EV["weekday"],d["cohortGuide"]),
      "把下列 10 位来访各写成一例完整病历，严守随附《档案文体规范》。其中 1 例深档（1200-2200 字、8-16 轮对话），9 例简档（400-800 字、短而完整）。危机例写安全计划与去向。",
      "【至关重要】你没有任何文件系统任务。禁止调用 Write/Edit/Bash 等任何工具，禁止把内容写到磁盘。你的整条回复就是产物——直接把这 10 例病历的完整 Markdown 文本作为回复正文输出，从第一例的 `## 编号 · 姓名 …` 开始，到最后一例结束，中间用单独一行 `---` 分隔，不要任何前言、说明、确认或结尾总结。",
      "","本册来访（编号已定，按此顺序写）：","\n".join(lines),"",STYLE])

def vetnbprompt(d):
    return "\n".join([
      "你是义诊第 %d 诊室主治【%s】（%s，%d岁，从业%d年；专长：%s；性格：%s；文风：%s）。"%(d["idx"],d["name"],d["title"],d["age"],d["years"],d["specialty"],d["personality"],d["voice"]),
      "这是'心难医·兼济公益义诊'第三日·中秋特别场（2026-09-25 中秋节当天）。你已连续第三天各接100例，今天还首次兼任分片督导——带四位新同行。前两日你已写过两页小本本，今天母题深化为：'%s'"%d["notebookTheme"],
      "请写《小本本》第三日（中秋夜）的一页（Markdown）：标题 `# 小本本 · %s · 第三日·中秋夜`；开头点明这是月升之后、最后一号看完才写的；今天这一域在'中秋当天'你看见了什么前两日没有的（2-4 条）；带新同行做督导，他们让你想起/学到什么；今天某一两位来访让你卡住或破防的瞬间（不写真名）；关于'自己'的新发现；给以后自己 3-5 条提醒；落款 %s + 2026-09-25 月升后。600-1100 字。【禁止调用任何工具/写文件，整条回复就是这页小本本的正文，从 `# 小本本 ·` 标题开始。】"%(d["name"],d["name"])])

def gen_case_wf(idxs,outpath,wfname):
    prepared=_load("d3_prepared.json",{})
    salv=_load("d3_cases_salvaged.json",[])
    done_ce={(c["idx"],c["start"]) for c in salv if c["kind"]=="册"}
    done_nb={c["idx"] for c in salv if c["kind"]=="本"}
    tasks=[]; skipped=0
    for i in idxs:
        room=prepared.get(str(i))
        if not room: print("室%d 未prep，跳过"%i); continue
        d=DOCS[i]
        bym={p["no"]:p for p in room["patients"]}
        for c,nos in enumerate(room["cefen"]):
            if (i,nos[0]) in done_ce: skipped+=1; continue
            block=[bym[n] for n in nos]
            tasks.append({"kind":"册","idx":i,"c":c+1,"start":nos[0],"end":nos[-1],
                "label":"%s·册%d(%s-%s)"%(d["name"],c+1,nos[0],nos[-1]),"prompt":caseprompt(d,block)})
        if not d["isNew"] and i not in done_nb:
            tasks.append({"kind":"本","idx":i,"name":d["name"],"label":"中秋夜记·"+d["name"],"prompt":vetnbprompt(d)})
    print("(skip已完成册 %d) "%skipped,end="")
    js='''export const meta = {
  name: '%s',
  description: '第三日写册：%s',
  phases: [{ title: '写病例', detail: '%d 任务并行' }],
}
const T = __T__
phase('写病例')
const done = await parallel(T.map(t => () =>
  agent(t.prompt, { label: t.label, phase: '写病例' }).then(content => ({ kind:t.kind, idx:t.idx, c:t.c, start:t.start, end:t.end, name:t.name, content }))
))
return { results: done.filter(Boolean) }
'''%(wfname,"室"+",".join(map(str,idxs)),len(tasks))
    js=js.replace("__T__",json.dumps(tasks,ensure_ascii=False))
    open(outpath,"w",encoding="utf-8").write(js)
    print("gen_case_wf:",outpath,len(tasks),"任务",os.path.getsize(outpath),"字节")

def gen_roster_wf(missing,outpath):
    RS={"type":"object","additionalProperties":False,"required":["patients"],"properties":{
     "patients":{"type":"array","minItems":100,"maxItems":100,"items":{"type":"object","additionalProperties":False,
      "required":["seq","name","sex","age","occupation","presentation","modality","depth","codeHint","session","notable"],
      "properties":{"seq":{"type":"integer"},"name":{"type":"string"},"sex":{"type":"string","enum":["女","男","非二元"]},
       "age":{"type":"integer"},"occupation":{"type":"string"},"presentation":{"type":"string"},"modality":{"type":"string"},
       "depth":{"type":"string","enum":["深","简"]},"codeHint":{"type":"string"},"session":{"type":"string"},"notable":{"type":"string"}}}}}}
    AV=",".join(sorted(AVOID_CANON))
    T=[]
    for i in missing:
        d=DOCS[i]
        p=("你是义诊第 %d 诊室主治【%s】（%s；专长：%s；取向：%s）。\n"
        "这是'心难医·兼济公益义诊'第三日·中秋特别场：2026-09-25 中秋节当天，50间诊室各接100例，主题：'%s'。不收费不拒诊。\n\n"
        "请为你这一室设计【恰好100位全新来访】花名册。本室当日群像：'%s'\n要求：\n"
        "- 紧扣'中秋当天'：来访是从今晚的饭桌、空屋和月亮底下直接走来的人——痛在'此刻'。\n"
        "- 专长域内高多样性（年龄/性别/职业/阶层/城乡）；首诊为主，杂以危机/联合/复诊/随访；含2-4例危机绿色通道。\n"
        "- 主诉真实朴素带生活毛边；depth 恰好10例'深'其余90'简'；每位给一个 notable 鲜活细节种子。\n"
        "- seq 1-100。姓名全部全新、用少见有辨识度的姓名（2-3字），本室内不重复，避开避讳名单：%s")%(
        d["idx"],d["name"],d["title"],d["specialty"],d["orientation"],EV["theme"],d["cohortGuide"],AV)
        T.append({"idx":i,"name":d["name"],"label":"花名册·%02d·%s"%(i,d["name"]),"prompt":p})
    js='''export const meta = {
  name: 'd3-rosters-regen',
  description: '第三日：补跑缺失花名册（%d 室）',
  phases: [{ title: '花名册', detail: '%d agents 并行' }],
}
const T = __T__
const RS = __RS__
phase('花名册')
const done = await parallel(T.map(t => () =>
  agent(t.prompt, { label: t.label, phase: '花名册', schema: RS }).then(r => ({ idx:t.idx, name:t.name, patients:(r&&r.patients)||[] }))
))
return { rosters: done.filter(Boolean) }
'''%(len(missing),len(missing))
    js=js.replace("__T__",json.dumps(T,ensure_ascii=False)).replace("__RS__",json.dumps(RS,ensure_ascii=False))
    open(outpath,"w",encoding="utf-8").write(js)
    print("gen_roster_wf:",outpath,len(T),"任务")

if __name__=="__main__":
    cmd=sys.argv[1]
    if cmd=="prep": prep_rooms([int(x) for x in sys.argv[2].split(",")])
    elif cmd=="case": gen_case_wf([int(x) for x in sys.argv[2].split(",")],sys.argv[3],sys.argv[4])
    elif cmd=="roster": gen_roster_wf([int(x) for x in sys.argv[2].split(",")],sys.argv[3])
