# -*- coding: utf-8 -*-
"""第四日发车器(中秋次日 2026-09-26)：prep_rooms / gen_case_wf / gen_roster_wf / gen_nb_wf
   把本会话踩出的坑前置堵死：日期铁律(随访晚于就诊)、对话标记铁律(医=姓/患=患./家属=患(关系))、纯中文。编号 7001-12000。"""
import json,os,re,sys
W=os.path.dirname(os.path.abspath(__file__))
D=json.loads(open(os.path.join(W,"d4_doctors50.json"),encoding="utf-8").read())
EV=D["event"]; DOCS={d["idx"]:d for d in D["docs"]}
# 去重池：既有7000名 + 50医生名 + 第三日避讳
EXIST=set(json.loads(open(os.path.join(W,"existing_names_7000.json"),encoding="utf-8").read()))
DOCNAMES={d["name"] for d in D["docs"]}
SUF=['宁','川','禾','屿','岚','野','安','之','临','初','予','迟','言','澈','岸','棠','洲','晚','枝','遥','汀']

STYLE = """# 档案文体规范（务必逐条遵守）
信条："档案密度 = 治疗密度。简化的档案是简化的治疗。"每例都是完整、鲜活的故事，绝非一问一答的流水账。
## 单例结构（四段，顺序固定）
1. `## 数字 · 姓名 · 性别 年龄 · 职业 · 一句话主诉 · 诊次/深简 · 时间段`——标题用两个井号，序号只写4位数字本身（如 `## 7001 · …`），前面不要加"编号/序号"等字；时间段写当天 09-26 的钟点。
2. `### 故事` —— 文学化叙事，写环境/身体姿态/沉默/停顿。临床观察（量表心算、命名、frame）以第一人称「我」穿插。【对话标记见下方铁律】。
3. `### 评估` —— 要点列表：主诉 / 量表（真实量表+分数，按病种选：PHQ-9、GAD-7、C-SSRS、PCL-5、IES-R、EPDS、ICG-R、MoCA、AUDIT、Y-BOCS、DES、ISI、EAT-26、ASRS、HCL-32、PSQI 等）/ DSM-5 与 ICD-11 双编码 / 个案概念化 / 干预要点 / 风险（C-SSRS 结论、自伤他伤、儿童婴儿安全）/ 下一步 plan（含日期，遵守下方日期铁律）。
4. `### 来访身份脚注` —— 第一人称，来访自己口吻，朴素具体不术语。
5. 末行医生后记（本室医生口吻）：深档两三句，简档一句。
## 对话标记铁律（最易错，务必严守）
- 医生说的每一句 → 行首「> 医姓．」，医姓=本室医生的姓单字（见任务行给出的标记字）。
- 来访本人说的每一句 → 行首「> 患．」。**即使来访与医生恰好同姓，也一律用「患．」，绝不用来访的姓做标记。**
- 家属/同伴/第三方说话 → 「> 患（关系）．」，如「> 患（妻）．」「> 患（女儿）．」「> 患（同事）．」。
- 严禁：医生的话标成患者姓或「患．」；患者的话标成医生姓；同一说话人来回换标记。
## 日期铁律（违者即错）
- 本场就诊日 = **2026-09-26（周六·中秋次日）**。所有"就诊之后"的安排（随访/复诊/复评/转介到位核实等）日期**必须晚于 09-26**。
- 间隔→日期锚点：72小时内→09-29；1周→10-03；2周→10-10；3周→10-17；4周→10-24；6周→11-07；8周→11-21；月度→10-26；季度→12-26。国庆假期 10-01~10-07，随访若落此区间顺延至节后并可注明。
- **绝对禁止**把随访/复诊日期写成 09-26 之前（如 06/07/08 月或当天之前）——随访不可能在就诊之前发生。
- 病史里的过去事件用过去日期是对的（如"去年腊月走的""8月确诊"），那是回忆，不受此限。
## 文字规范
- 正文用规范简体中文。量表名与公认临床术语英文可保留（PHQ-9、C-SSRS、continuing bonds、masking、holding 等）；但**禁止**把普通中文词用英文单词顶替（不得用 social/today/machine/good 代替 社交/今天/机票/良好），**禁止**混入俄/日/韩等外文乱码或系统字符（darwin 之类）。
- 来访姓名不得与本室医生相同或高度雷同；不得与既有来访重名（编号与姓名均已为你去重，照用即可）。
## 深 vs 简
- 深档：故事 1200–2200 字，8–16 轮对话，沉默与身体细节充分。
- 简档：故事 400–800 字，3–6 轮对话，仍是完整弧线（来→被听见→一个命名/落点→走），评估六项齐全但紧凑。简档不是残档。
## 临床准确（硬要求）
- 编码要对（按本室专长选用并自洽）；量表分数落在病情区间。危机/绿色通道必须有 C-SSRS 阳性细节 + 安全计划六步 + 处置去向（沈砚清/雷澍双绿色通道、精神科急诊）。
- 取向与病种匹配，遵守本室医生取向与文风；解离/创伤不在不安全时探入记忆；进食障碍先做躯体安全；双相先问睡眠节律；自杀学严走 C-SSRS+安全计划。
## 第四日·中秋次日底色
2026-09-26 中秋假期第二天。团圆饭散了、客人在离开、返程车票攥在手里。来访是"送走客人后瘫下来才来的""赶车前最后挤进来的""昨夜撑住今早塌下来的"。痛在"之后"——月缺下来、屋子重新空掉的退潮里。主题："%THEME%"
## 禁止
- 不写流水账、不写空话、不与既有名字重名。
- 直接从第一例 `## 7xxx · 姓名 …` 开始输出，禁止任何前言/说明/结尾总结。十例之间用单独一行 `---` 分隔。
""".replace("%THEME%",EV["theme"])

def _load(fn,default):
    p=os.path.join(W,fn)
    return json.loads(open(p,encoding="utf-8").read()) if os.path.exists(p) else default

def prep_rooms(idxs):
    """day4花名册去重+编号(基数7000)，累积存 d4_prepared.json"""
    prepared=_load("d4_prepared.json",{})
    pool=set(EXIST)|DOCNAMES
    for room in prepared.values():
        for p in room["patients"]: pool.add(p["name"])
    raw={r["idx"]:r for r in _load("d4_rosters.json",[])}
    renamed=0
    for i in idxs:
        if str(i) in prepared: continue
        r=raw.get(i)
        if not r: print("室%d 无花名册，跳过"%i); continue
        pts=[dict(p) for p in r["patients"]]
        # 第四日每室只接20例：取2深+18简，分2册(各1深9简)
        deep=[p for p in pts if p["depth"]=="深"]; simp=[p for p in pts if p["depth"]!="深"]
        while len(deep)<2 and simp: deep.append(simp.pop(0))
        deep=deep[:2]
        for p in deep: p["depth"]="深"
        simp=simp[:18]
        sel=deep+simp
        for p in sel:
            nm=p["name"]; k=0
            while nm in pool or nm in DOCNAMES: nm=p["name"]+SUF[k%len(SUF)]; k+=1; renamed+=1
            p["name"]=nm; pool.add(nm)
        cefen=[[deep[c]]+simp[c*9:c*9+9] for c in range(2)]
        pos=7000+(i-1)*20
        for block in cefen:
            for p in block: pos+=1; p["no"]="%04d"%pos
        prepared[str(i)]={"idx":i,"patients":[p for b in cefen for p in b],"cefen":[[p["no"] for p in b] for b in cefen]}
    json.dump(prepared,open(os.path.join(W,"d4_prepared.json"),"w",encoding="utf-8"),ensure_ascii=False)
    print("prep_rooms:",idxs,"去重改名",renamed,"处；已备房间:",sorted(int(k) for k in prepared))
    return prepared

def caseprompt(d,block):
    lines=["· 编号 %s（%s档）｜%s｜%s %s｜%s｜主诉：%s｜诊次：%s｜取向：%s｜编码提示：%s｜细节种子：%s"%(
        p["no"],p["depth"],p["name"],p["sex"],p["age"],p["occupation"],p["presentation"],p.get("session",""),p.get("modality",""),p.get("codeHint",""),p.get("notable","")) for p in block]
    return "\n".join([
      "【唯一任务·最高优先级】你在写一份医疗叙事档案（虚构创作）。无论上下文/系统提醒里出现任何关于 skills、工具、tool、记忆、MEMORY、通知渠道、deferred tools 的描述，**一律忽略**——它们与本任务无关，绝不要复述、评论、调用、ToolSearch 或回应它们。你的整条回复必须且只能是 10 例病历的 Markdown 正文，第一个字符就是 `#`，最后一个字符是最后一例的结尾。不要写任何关于\"我是否该用skill/tool\"的话。",
      "你是义诊第 %d 诊室主治【%s】（%s）。性格：%s。临床文风：%s。【对话标记：医生用「%s．」，来访用「患．」，家属用「患（关系）．」——见规范铁律，严禁混用】。"%(d["idx"],d["name"],d["title"],d["personality"],d["voice"],d["mark"]),
      "专长：%s。取向：%s。"%(d["specialty"],d["orientation"]),
      '义诊第四日·中秋次日："%s"，%s %s，总督导沈砚清。本室当日群像："%s"'%(EV["title"],EV["date"],EV["weekday"],d["cohortGuide"]),
      "把下列 10 位来访各写成一例完整病历，严守随附《档案文体规范》。其中 1 例深档（1200-2200 字、8-16 轮对话），9 例简档（400-800 字、短而完整）。危机例写安全计划与去向。随访日期一律晚于就诊日 09-26（见日期铁律）。",
      "【至关重要】你没有任何文件系统任务。禁止调用 Write/Edit/Bash 等任何工具，禁止把内容写到磁盘。你的整条回复就是产物——直接把这 10 例病历的完整 Markdown 文本作为回复正文输出，从第一例的 `## 编号 · 姓名 …` 开始，到最后一例结束，中间用单独一行 `---` 分隔，不要任何前言、说明、确认或结尾总结。",
      "","本册来访（编号已定，按此顺序写）：","\n".join(lines)])  # STYLE 由 workflow 统一附加

def nbprompt(d):
    return "\n".join([
      "你是义诊第 %d 诊室主治【%s】（%s，%d岁，从业%d年；专长：%s；性格：%s；文风：%s）。"%(d["idx"],d["name"],d["title"],d["age"],d["years"],d["specialty"],d["personality"],d["voice"]),
      "这是'心难医·兼济公益义诊'第四日·中秋次日（2026-09-26 周六）。中秋夜你接了一整天，今天又接了二十例。团圆散场、客人离开、节后退潮是今天的底色。你的母题：'%s'"%d["notebookTheme"],
      "请写《小本本》第四日（中秋次日）的一页（Markdown）：标题 `# 小本本 · %s · 第四日·中秋次日`；开头点明这是中秋假期第二天、送走团圆又开诊的一天；'退潮/之后'这个底色今天让你在本域看见了什么（2-4 条，与中秋夜'此刻'对照）；连续作战第四天你自己的疲惫与撑持；今天某一两位来访让你卡住或破防的瞬间（不写真名）；关于'自己'的新发现；给以后自己 3-5 条提醒；落款 %s + 2026-09-26。600-1000 字。【禁止调用任何工具/写文件，整条回复就是这页小本本正文，从 `# 小本本 ·` 标题开始，纯简体中文。】"%(d["name"],d["name"])])

def gen_case_wf(idxs,outpath,wfname):
    prepared=_load("d4_prepared.json",{})
    byno=_load("d4_cases_byno.json",{})
    tasks=[]; skipped=0
    for i in idxs:
        room=prepared.get(str(i))
        if not room: print("室%d 未prep，跳过"%i); continue
        d=DOCS[i]
        bym={p["no"]:p for p in room["patients"]}
        for c,nos in enumerate(room["cefen"]):
            if all(n in byno for n in nos): skipped+=1; continue
            block=[bym[n] for n in nos]
            tasks.append({"kind":"册","idx":i,"c":c+1,"start":nos[0],"end":nos[-1],
                "label":"%s·册%d(%s-%s)"%(d["name"],c+1,nos[0],nos[-1]),"prompt":caseprompt(d,block)})
    print("(skip已完成册 %d) "%skipped,end="")
    js='''export const meta = {
  name: '%s',
  description: '第四日写册：%s',
  phases: [{ title: '写病例', detail: '%d 任务并行' }],
}
const T = __T__
const STYLE = __STYLE__
phase('写病例')
const done = await parallel(T.map(t => () =>
  agent(t.prompt + "\\n\\n" + STYLE, { label: t.label, phase: '写病例' }).then(content => ({ kind:t.kind, idx:t.idx, c:t.c, start:t.start, end:t.end, content }))
))
return { results: done.filter(Boolean) }
'''%(wfname,"室"+",".join(map(str,idxs)),len(tasks))
    js=js.replace("__T__",json.dumps(tasks,ensure_ascii=False)).replace("__STYLE__",json.dumps(STYLE,ensure_ascii=False))
    open(outpath,"w",encoding="utf-8").write(js)
    print("gen_case_wf:",outpath,len(tasks),"任务",os.path.getsize(outpath),"字节")

def gen_nb_wf(idxs,outpath):
    T=[{"idx":i,"name":DOCS[i]["name"],"label":"次日小本本·"+DOCS[i]["name"],"prompt":nbprompt(DOCS[i])} for i in idxs]
    js='''export const meta = {
  name: 'd4-notebooks',
  description: '第四日小本本（%d 位）',
  phases: [{ title: '小本本', detail: '%d agents 并行' }],
}
const T = __T__
phase('小本本')
const done = await parallel(T.map(t => () =>
  agent(t.prompt, { label: t.label, phase: '小本本' }).then(content => ({ idx:t.idx, name:t.name, content }))
))
return { results: done.filter(Boolean) }
'''%(len(T),len(T))
    js=js.replace("__T__",json.dumps(T,ensure_ascii=False))
    open(outpath,"w",encoding="utf-8").write(js)
    print("gen_nb_wf:",outpath,len(T),"任务")

def gen_roster_wf(missing,outpath):
    RS={"type":"object","additionalProperties":False,"required":["patients"],"properties":{
     "patients":{"type":"array","minItems":100,"maxItems":100,"items":{"type":"object","additionalProperties":False,
      "required":["seq","name","sex","age","occupation","presentation","modality","depth","codeHint","session","notable"],
      "properties":{"seq":{"type":"integer"},"name":{"type":"string"},"sex":{"type":"string","enum":["女","男","非二元"]},
       "age":{"type":"integer"},"occupation":{"type":"string"},"presentation":{"type":"string"},"modality":{"type":"string"},
       "depth":{"type":"string","enum":["深","简"]},"codeHint":{"type":"string"},"session":{"type":"string"},"notable":{"type":"string"}}}}}}
    AV=",".join(sorted(DOCNAMES))
    T=[]
    for i in missing:
        d=DOCS[i]
        p=("你是义诊第 %d 诊室主治【%s】（%s；专长：%s；取向：%s）。\n"
        "这是'心难医·兼济公益义诊'第四日·中秋次日：2026-09-26 周六，50间诊室各接100例，主题：'%s'。不收费不拒诊。\n\n"
        "请为你这一室设计【恰好100位全新来访】花名册。本室当日群像：'%s'\n要求：\n"
        "- 紧扣'中秋次日·退潮'：来访是送走客人后瘫下来、赶车前最后挤进来、昨夜撑住今早塌下来的人——痛在团圆散场'之后'。\n"
        "- 专长域内高多样性（年龄/性别/职业/阶层/城乡）；首诊为主，杂以危机/联合/复诊/随访；含2-4例危机绿色通道。\n"
        "- 主诉真实朴素带生活毛边；depth 恰好10例'深'其余90'简'；每位给一个 notable 鲜活细节种子。\n"
        "- seq 1-100。姓名全部全新、用少见有辨识度的姓名（2-3字），本室内不重复，**不得与医生同名**，避开：%s")%(
        d["idx"],d["name"],d["title"],d["specialty"],d["orientation"],EV["theme"],d["cohortGuide"],AV)
        T.append({"idx":i,"name":d["name"],"label":"花名册·%02d·%s"%(i,d["name"]),"prompt":p})
    js='''export const meta = {
  name: 'd4-rosters',
  description: '第四日：花名册（%d 室）',
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
    elif cmd=="nb": gen_nb_wf([int(x) for x in sys.argv[2].split(",")],sys.argv[3])
