export const meta = {
  name: 'd3-reaudit-5x5',
  description: '第三日室26-50语义回扫:5个agent各审5室(低并发避限流)',
  phases: [{ title: 'Audit', detail: '5组并发,每组5室' }],
}
const ROOMS = typeof args === 'string' ? JSON.parse(args) : args  // [[folder,idx,name,mark],...] 25个
const GROUPS = []
for (let i=0;i<ROOMS.length;i+=5) GROUPS.push(ROOMS.slice(i,i+5))

const RULES = `【审计规则】本场就诊日=2026-09-25（中秋当天）。逐字精读，只报真缺陷，宁缺毋滥。
1) foreign_lang（最重要）：非中文语言文字出现在【医生自己的叙事/临床记录】里（第一人称"我"的观察、### 评估各栏、医生后记、以及标为本室医生姓的医生发言）。
   必改：医生记录里混入的外文词/句（英/俄/日/韩/法/罗马尼亚语等整词整句，把普通中文意思用外文写了，如 frame/social/language/basically/body scan/risk/account/acum/externalize 等）。
   不动（合法）：①患者对话「> 患．」行里说外语；②公认临床术语与量表英文缩写(PHQ-9 GAD-7 C-SSRS PCL-5 EPDS ICG-R MoCA AUDIT Y-BOCS DES ISI EAT-26 ASRS PSQI EMDR CBT ACT IPT DBT IFS ERP SUDS SSRI 及 DSM-5/ICD-11 英文病名 如 Adjustment Disorder / Major Depressive Disorder、量表名 Zarit/Kupperman、概念 continuing bonds/ambiguous loss/disenfranchised grief/moral injury/Minority Stress、单位 bpm/mmHg 等)；③外籍人物专有人名；④医生引述患者刚说的外语词且【紧跟中文释义】(如 차례（茶礼）、месяц——月亮)。
2) speaker_mislabel：医生的话被标成患者的姓或「患．」；患者的话被标成医生姓；家属应作「患（关系）．」而非裸标「妻．」；性别代词误指(如女医生被患者叙述为"他")；错字标记(如「蒌．」应为「蒲．」)。本室医生姓见下。患者与医生恰好同姓时患者本人用「患．」是对的。
3) cross_case：患者被叫成别的病例的名字，或医患姓名张冠李戴。注意"双绿色通道（沈砚清/雷澍）"是本场设计，雷澍是真实危机医生，不要把雷澍当错误删改。
4) date_error：随访/复诊/复评等就诊之后的安排日期早于/等于 2026-09-25（"9-23/24本室首诊""今日9-25""9-26/27假期随访"是合法的，不报）。
5) garbage：乱码字符、系统/工具文本泄漏、占位/自纠残留(如"？修正""以提示为准"、重复堆叠编码)、明显截断、标题名与正文不一致(多/少字)。`

const SCHEMA={type:'object',additionalProperties:false,required:['findings'],properties:{
  findings:{type:'array',items:{type:'object',additionalProperties:false,
    required:['room','caseNo','file','type','quote','suggestion','confidence'],properties:{
      room:{type:'string'},caseNo:{type:'string'},file:{type:'string',description:'文件名如 03-2121-2130.md'},
      type:{type:'string',enum:['foreign_lang','speaker_mislabel','cross_case','date_error','garbage','other']},
      quote:{type:'string',description:'缺陷处原文精确片段(≥8字,便于唯一定位)'},
      suggestion:{type:'string',description:'改成什么(中文)'},
      confidence:{type:'string',enum:['high','medium','low']}}}}}}

phase('Audit')
const results = await parallel(GROUPS.map((group,gi) => () => {
  const roomList = group.map(([folder,idx,name,mark])=>`  · 第${idx}诊室 主治【${name}】(医生姓「${mark}」) 文件夹:${folder}`).join('\n')
  return agent(
`你是诊疗档案校对医生，精读下面【5个诊室】第三日(2026-09-25 中秋当天)的全部病例，逐室逐例找文字缺陷。

本组5个诊室:
${roomList}

步骤:① 逐个诊室处理——用 Glob/Bash 列出该诊室文件夹下所有 [0-9][0-9]-*.md 病例册(各约10个,跳过 00- 与 小本本),逐个 Read 读完整;② 按下方规则逐例排查;③ 每条缺陷给出:room(医生名)、病例编号caseNo、文件名file、类型type、原文精确片段quote(≥8字)、中文改法suggestion、置信度confidence。5个室的发现全部汇总进一个 findings 数组。没有缺陷就返回空数组。务必5个室都读到,不要遗漏任何一个室。

${RULES}`,
    {schema:SCHEMA, phase:'Audit', label:`audit组${gi+1}:${group[0][1]}-${group[group.length-1][1]}`})
  .then(r=>({group:gi+1, findings:(r&&r.findings)||[]}))
  .catch(e=>({group:gi+1, findings:[], error:String(e)}))
}))
const all = results.flatMap(r=>(r.findings||[]).map(f=>({...f,group:r.group})))
const errs = results.filter(r=>r.error).map(r=>({group:r.group,error:r.error}))
log(`5组审完 | 发现${all.length}条 | 失败组${errs.length}`)
return { findings: all, errors: errs }
