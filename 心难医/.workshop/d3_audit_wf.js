export const meta = {
  name: 'd3-reaudit',
  description: '第三日5000例语义回扫:医生记录里的外语/乱码、说话人标记错配、串案、日期倒流',
  phases: [
    { title: 'Audit', detail: '50室并发逐室精读' },
    { title: 'Verify', detail: '每条发现对抗复核' },
  ],
}
const ROOMS = typeof args === 'string' ? JSON.parse(args) : args  // [[folder,idx,name,mark],...]

const RULES = `【审计规则】本场就诊日 = 2026-09-25（中秋当天），主诉以"团圆夜此刻"为底色。逐字精读，只报真缺陷，宁缺毋滥。

1) foreign_lang（最重要）：非中文语言文字出现在【医生自己的叙事/临床记录】里——即第一人称"我"的观察叙述、### 评估 各栏、医生后记、以及医生（标记为本室医生姓）的话。
   - 必须改：医生记录中混入的外文词/句（俄/日/韩/法/英整词整句等），把普通意思用外文写了，应改回规范中文。
   - 不要动（合法）：① 患者本人对话（「> 患．」行）里说外语——这是角色，保留；② 公认临床术语与量表英文缩写：PHQ-9 GAD-7 C-SSRS PCL-5 IES-R EPDS ICG-R MoCA AUDIT Y-BOCS DES ISI EAT-26 ASRS HCL-32 PSQI EMDR CBT ACT IPT DBT IFS SSRI continuing bonds masking holding grounding flooding 等；③ 外籍人物的专有人名（如葡萄牙籍 Mateo、法语区 Étienne）；④ 医生引述患者刚说的那个外语词且【紧跟中文释义】（如 '차례（茶礼）'、'месяц——月亮'、'ありがとう（日语谢谢）'）——这是带翻译的引用，保留。
   - 判断关键：是"患者说的/带翻译引用的"（留），还是"医生拿外文替了中文词来叙述/分析"（改）。

2) speaker_mislabel：医生的话被标成患者的姓或「患．」；患者的话被标成医生姓；家属应作「患（关系）．」；以及残缺/异常标记（如「患．开头缺 >、用了「而非 >）。本室医生姓见任务。注意：患者与医生【恰好同姓】时，患者本人的话仍用「患．」是对的，不是错。

3) cross_case：患者被叫成别的病例的名字，或医患姓名张冠李戴，或患者姓名与本室医生雷同到混淆。

4) date_error：随访/复诊/复评等就诊【之后】的安排，日期早于或等于 2026-09-25。注意"9-23/9-24 本室首诊""今日9-25"是合法的过去/当日引用，不是错；"9-26/9-27 假期随访"也对。

5) garbage：乱码字符（�）、系统/工具文本泄漏、占位残留、明显截断。`

const AUDIT_SCHEMA={type:'object',additionalProperties:false,required:['room','caseCount','findings'],properties:{
  room:{type:'string'},caseCount:{type:'integer'},
  findings:{type:'array',items:{type:'object',additionalProperties:false,
    required:['caseNo','file','type','quote','suggestion','confidence'],properties:{
      caseNo:{type:'string'},file:{type:'string'},
      type:{type:'string',enum:['foreign_lang','speaker_mislabel','cross_case','date_error','garbage','other']},
      quote:{type:'string',description:'缺陷处原文精确片段(≥8字便于唯一定位)'},
      suggestion:{type:'string',description:'改成什么(中文)'},
      confidence:{type:'string',enum:['high','medium','low']}}}}}}

const VERDICT_SCHEMA={type:'object',additionalProperties:false,required:['caseNo','isReal','reason','exactOld','exactNew'],properties:{
  caseNo:{type:'string'},isReal:{type:'boolean'},reason:{type:'string'},
  exactOld:{type:'string',description:'若isReal:文件中逐字存在、可唯一定位的待替换串'},
  exactNew:{type:'string',description:'若isReal:替换结果(规范中文)'}}}

phase('Audit')
const results = await pipeline(ROOMS,
  ([folder,idx,name,mark]) => agent(
`你是诊疗档案校对医生，精读第${idx}诊室（主治【${name}】，医生姓「${mark}」）第三日（2026-09-25 中秋当天）的全部病例，找文字缺陷。

诊室文件夹：${folder}
步骤：① 用 Glob/Bash 列出该文件夹下所有 [0-9][0-9]-*.md 病例册（约10个，跳过 00- 与 小本本），逐个 Read 读完整；② 按下方规则逐例排查；③ 每条缺陷给：病例编号、文件名、类型、原文精确片段(quote,≥8字)、中文改法、置信度。没有就返回空 findings。caseCount 填实际读到的病例数。

${RULES}`,
    {schema:AUDIT_SCHEMA, phase:'Audit', label:`audit:${idx}-${name}`}).catch(()=>({room:name,caseCount:0,findings:[]})),

  (audit,[folder,idx,name,mark]) => {
    if(!audit||!audit.findings||!audit.findings.length) return []
    return parallel(audit.findings.map(f => () =>
      agent(
`对抗复核一条疑似缺陷，独立判断真伪，倾向怀疑：若属合法内容（患者说外语、带中文释义的引用、公认临床术语/量表英文、外籍人名、同姓患者本人说话用患．、过去/当日日期引用）一律判 false。
文件：${folder}/${f.file}　病例：${f.caseNo}　类型：${f.type}
片段：${JSON.stringify(f.quote)}　建议：${JSON.stringify(f.suggestion)}　本室医生姓「${mark}」
步骤：Read 打开文件定位该处，读前后文判定。isReal=true 仅当确为缺陷且修了更对；给 exactOld(文件中逐字存在、唯一可定位的串)与 exactNew(规范中文)。
${RULES}`,
        {schema:VERDICT_SCHEMA, phase:'Verify', label:`verify:${f.caseNo}-${f.type}`})
      .then(v=>({...f,room:name,folder,verdict:v})).catch(()=>null)
    )).then(a=>a.filter(Boolean))
  }
)
const all = results.flat().filter(Boolean)
const confirmed = all.filter(f=>f.verdict&&f.verdict.isReal)
log(`第三日审完50室 | 原始疑点${all.length} 复核确认${confirmed.length}`)
return { rawCount: all.length, confirmed: confirmed.map(f=>({room:f.room,caseNo:f.caseNo,folder:f.folder,file:f.file,type:f.type,exactOld:f.verdict.exactOld,exactNew:f.verdict.exactNew,reason:f.verdict.reason})) }
