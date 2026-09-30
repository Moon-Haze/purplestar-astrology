import type { ZiweiChart } from './types';

// 主星五行属性
const STAR_ELEMENT: Record<string, string> = {
  '紫微': '土', '天机': '木', '太阳': '火', '武曲': '金',
  '天同': '水', '廉贞': '火', '天府': '土', '太阴': '水',
  '贪狼': '木', '巨门': '水', '天相': '水', '天梁': '土',
  '七杀': '金', '破军': '水',
  // 辅星
  '文昌': '金', '文曲': '水', '左辅': '土', '右弼': '水',
  '天魁': '火', '天钺': '火', '禄存': '土', '天马': '火',
  '地空': '火', '地劫': '火', '火星': '火', '铃星': '火',
};

// 五行缺失对应的风水补局建议
const ELEMENT_REMEDY: Record<string, {
  items: string[];
  colors: string[];
  plants?: string[];
  direction: string;
  desc: string;
}> = {
  '水': {
    items: ['水晶球', '流水摆件', '水族箱', '蓝色玻璃器皿'],
    colors: ['蓝色', '黑色', '深紫色'],
    direction: '北方',
    desc: '水主智慧、流动与财运。补水有助于增强思维敏锐度与财富流动性。',
  },
  '火': {
    items: ['红色物件', '灯具加光', '红色挂画', '蜡烛台'],
    colors: ['红色', '橙色', '紫红色'],
    direction: '南方',
    desc: '火主热情、名声与社交。补火有助于增强个人影响力与人际关系。',
  },
  '金': {
    items: ['金色风车', '铜制摆件', '白色水晶', '金属工艺品'],
    colors: ['金色', '白色', '银色'],
    direction: '西方',
    desc: '金主决断、财富积累与组织力。补金有助于增强执行力与财库。',
  },
  '木': {
    items: ['绿植盆栽', '竹节摆件', '木质装饰', '青色挂画'],
    colors: ['绿色', '青色', '浅蓝色'],
    plants: ['富贵竹', '绿萝', '发财树', '橡皮树'],
    direction: '东方',
    desc: '木主生机、成长与健康。补木有助于增强生命力、学业与健康运势。',
  },
  '土': {
    items: ['黄色陶瓷', '天然石材', '土黄挂画', '水晶洞'],
    colors: ['黄色', '土黄色', '棕色'],
    direction: '中央/西南/东北',
    desc: '土主稳定、信用与不动产。补土有助于增强稳定性、信誉与置产运。',
  },
};

// 命宫地支对应的吉位方向（本命吉方）
const BRANCH_AUSPICIOUS_DIR: Record<number, { main: string; sub: string }> = {
  0:  { main: '北方', sub: '西北' },  // 子
  1:  { main: '东北', sub: '北方' },  // 丑
  2:  { main: '东方', sub: '东北' },  // 寅
  3:  { main: '东方', sub: '东南' },  // 卯
  4:  { main: '东南', sub: '东方' },  // 辰
  5:  { main: '南方', sub: '东南' },  // 巳
  6:  { main: '南方', sub: '西南' },  // 午
  7:  { main: '西南', sub: '南方' },  // 未
  8:  { main: '西方', sub: '西南' },  // 申
  9:  { main: '西方', sub: '西北' },  // 酉
  10: { main: '西北', sub: '西方' },  // 戌
  11: { main: '北方', sub: '西北' },  // 亥
};

export interface FengshuiResult {
  elementCounts: Record<string, number>;
  missingElements: string[];
  weakElements: string[];   // 出现1次
  strongElements: string[]; // 出现3次以上
  remedies: Array<{
    element: string;
    level: 'missing' | 'weak';
    items: string[];
    colors: string[];
    plants?: string[];
    direction: string;
    desc: string;
  }>;
  auspiciousDir: { main: string; sub: string };
  mingGongElement: string; // 命宫五行局
}

export function analyzeFengshui(chart: ZiweiChart): FengshuiResult {
  const ALL_ELEMENTS = ['金', '木', '水', '火', '土'];

  // 统计命宫+三方四正的星曜五行
  const mingBranch = chart.mingGongBranch;
  // 三方四正: 命宫, 财帛(+4), 官禄(+8), 迁移(+6)
  const keyBranches = new Set([
    mingBranch,
    (mingBranch + 4) % 12,
    (mingBranch + 8) % 12,
    (mingBranch + 6) % 12,
  ]);

  const counts: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };

  // 统计关键宫位的星曜
  chart.palaces.forEach(palace => {
    if (keyBranches.has(palace.branch)) {
      palace.stars.forEach(star => {
        const el = STAR_ELEMENT[star.name];
        if (el && el in counts) counts[el]++;
      });
    }
  });

  // 五行局本身计入
  const juElementMap: Record<string, string> = {
    '水二局': '水', '木三局': '木', '金四局': '金',
    '土五局': '土', '火六局': '火',
  };
  const juEl = juElementMap[chart.wuxingJuName];
  if (juEl) counts[juEl] += 2; // 五行局权重更大

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const avg = total / 5;

  const missingElements = ALL_ELEMENTS.filter(e => counts[e] === 0);
  const weakElements = ALL_ELEMENTS.filter(e => counts[e] > 0 && counts[e] < avg * 0.6);
  const strongElements = ALL_ELEMENTS.filter(e => counts[e] >= avg * 1.5);

  const remedies = [
    ...missingElements.map(e => ({ element: e, level: 'missing' as const, ...ELEMENT_REMEDY[e] })),
    ...weakElements.map(e => ({ element: e, level: 'weak' as const, ...ELEMENT_REMEDY[e] })),
  ];

  return {
    elementCounts: counts,
    missingElements,
    weakElements,
    strongElements,
    remedies,
    auspiciousDir: BRANCH_AUSPICIOUS_DIR[mingBranch] ?? { main: '东方', sub: '南方' },
    mingGongElement: juEl ?? '土',
  };
}
