export const meta = {
  name: 'd3-rosters-regen',
  description: '第三日：补跑缺失花名册（1 室）',
  phases: [{ title: '花名册', detail: '1 agents 并行' }],
}
const T = [{"idx": 50, "name": "裘暮云", "label": "花名册·50·裘暮云", "prompt": "你是义诊第 50 诊室主治【裘暮云】（市老年病康复医院心理科原主任（退休返聘），老年照护研究会副会长、全市喘息服务试点发起人；专长：失能失智照护者的抑郁与耗竭、照护中的愤怒与羞耻、'久病床前'的婚姻与孝道冲突、老老照护（老伴照护老伴）、机构托养内疚、子女间照护分工冲突、照护结束后的空洞与复合哀伤；取向：Pearlin照护者压力-应对模型下的支持性治疗+喘息服务个案管理）。\n这是'心难医·兼济公益义诊'第三日·中秋特别场：2026-09-25 中秋节当天，50间诊室各接100例，主题：'月亮今晚只有一种圆法，人间却有五千种不圆——五十间亮着灯的屋子不劝人圆满，只在月圆这一夜，给每一种'人不圆'留一扇开着的门。'。不收费不拒诊。\n\n请为你这一室设计【恰好100位全新来访】花名册。本室当日群像：'团圆饭做好了，照护没有假期。约半数是失能失智长者的照护者：趁回乡的兄弟姐妹'替一天班'，才第一次走进诊室——很多人一坐下先道歉'我只有两个小时'。老老照护的八旬丈夫，一开口就在椅子上睡着了，他太累了。照护分工在团圆饭桌上吵翻的姐弟；把母亲送进机构后第一个中秋、内疚到不敢动筷子的女儿。还有照护已经结束的人——人走了，手还在每天凌晨四点醒来，要去喂药。'\n要求：\n- 紧扣'中秋当天'：来访是从今晚的饭桌、空屋和月亮底下直接走来的人——痛在'此刻'。\n- 专长域内高多样性（年龄/性别/职业/阶层/城乡）；首诊为主，杂以危机/联合/复诊/随访；含2-4例危机绿色通道。\n- 主诉真实朴素带生活毛边；depth 恰好10例'深'其余90'简'；每位给一个 notable 鲜活细节种子。\n- seq 1-100。姓名全部全新、用少见有辨识度的姓名（2-3字），本室内不重复，避开避讳名单：万昭弦,严问初,乔虹,仇微寻,伏衡远,关朴,冼洄,凉璎,凌徽鸢,包嘉迩,卓晏宁,单语澄,卞迟暄,卫持平,原上草,古一苇,叶忱,商行简,宫迟,展鸿羽,屠青梧,岑樾,巫栀清,平岱兰,庄白描,应澹生,慕岸,戚念白,戴景澄,房书远,昌峙,曾秋云,杭聿言,查岸生,桑斐然,桓蕴风,楚谙澈,楼霁,欧翎,步遥岸,段景渊,殷栩之,江默深,池野,沃霁岚,沈砚之,沈砚清,沛雪渚,洪屿,温汀露,滕窈,满徵羽,狄安澜,甄迟,甘止水,白岫青,祝绒,穆停云,章珩,童晚秋,简之窈,翟暖,聂籁,苏怀瑾,茅敬之,荀枝,蒋望舒,蒙穗微,蒲聆,蓝舸宁,蓟疏桐,蔺照,虞声晚,裘暮云,裴知秋,覃禾,谢淙音,路阙音,连漪,邢知微,邵临江,邹璧寒,郁桓,郑筠,都望之,鄢清越,闻翊,阮渡,阿砚,雍黛,雷澍,霍铮,韦砚舟,韶归,顾雪莺,颜溯,骆雪宜,魏衡,麦小满,齐默,龙翰宇"}]
const RS = {"type": "object", "additionalProperties": false, "required": ["patients"], "properties": {"patients": {"type": "array", "minItems": 100, "maxItems": 100, "items": {"type": "object", "additionalProperties": false, "required": ["seq", "name", "sex", "age", "occupation", "presentation", "modality", "depth", "codeHint", "session", "notable"], "properties": {"seq": {"type": "integer"}, "name": {"type": "string"}, "sex": {"type": "string", "enum": ["女", "男", "非二元"]}, "age": {"type": "integer"}, "occupation": {"type": "string"}, "presentation": {"type": "string"}, "modality": {"type": "string"}, "depth": {"type": "string", "enum": ["深", "简"]}, "codeHint": {"type": "string"}, "session": {"type": "string"}, "notable": {"type": "string"}}}}}}
phase('花名册')
const done = await parallel(T.map(t => () =>
  agent(t.prompt, { label: t.label, phase: '花名册', schema: RS }).then(r => ({ idx:t.idx, name:t.name, patients:(r&&r.patients)||[] }))
))
return { rosters: done.filter(Boolean) }
