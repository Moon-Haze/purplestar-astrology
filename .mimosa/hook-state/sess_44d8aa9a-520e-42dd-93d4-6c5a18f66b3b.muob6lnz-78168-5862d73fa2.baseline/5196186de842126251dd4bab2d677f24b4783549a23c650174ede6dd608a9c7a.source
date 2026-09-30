import type { ZiweiChart, Palace } from './types';

export interface Pattern {
  name: string;
  level: 'excellent' | 'good' | 'neutral' | 'caution';
  description: string;
  palaces: string[];  // 涉及的宫位
}

// 获取某宫位的主星名列表
function getMajorStarNames(palace: Palace): string[] {
  return palace.stars.filter(s => s.type === 'major').map(s => s.name);
}

// 某颗主星在哪个宫
function findStarPalace(chart: ZiweiChart, starName: string): Palace | undefined {
  return chart.palaces.find(p =>
    p.stars.some(s => s.type === 'major' && s.name === starName)
  );
}

// 命宫、财帛宫、官禄宫、迁移宫 (三方四正)
function getSanFangPalaces(chart: ZiweiChart): Palace[] {
  const mingBranch = chart.mingGongBranch;
  const sanFangBranches = [
    mingBranch,
    (mingBranch + 4) % 12,   // 财帛宫
    (mingBranch + 8) % 12,   // 官禄宫
    (mingBranch + 6) % 12,   // 迁移宫 (对宫)
  ];
  return chart.palaces.filter(p => sanFangBranches.includes(p.branch));
}

export function detectPatterns(chart: ZiweiChart): Pattern[] {
  const patterns: Pattern[] = [];
  const sanFang = getSanFangPalaces(chart);
  const sanFangStars = sanFang.flatMap(p => getMajorStarNames(p));
  const mingPalace = chart.palaces.find(p => p.branch === chart.mingGongBranch)!;
  const mingStars = getMajorStarNames(mingPalace);

  // ── 1. 紫府同宫 ──────────────────────────────────────────
  const ziweiPalace = findStarPalace(chart, '紫微');
  const tianfuPalace = findStarPalace(chart, '天府');
  if (ziweiPalace && tianfuPalace && ziweiPalace.branch === tianfuPalace.branch) {
    patterns.push({
      name: '紫府同宫',
      level: 'excellent',
      description: '紫微天府同宫，帝相并临，尊贵之命。主人品行端正，一生衣食无忧，有领导才能，适合担任要职。',
      palaces: [ziweiPalace.name],
    });
  }

  // ── 2. 杀破狼 ──────────────────────────────────────────
  const shaPo = ['七杀', '破军', '贪狼'];
  const shaPoInSanFang = shaPo.filter(s => sanFangStars.includes(s));
  if (shaPoInSanFang.length >= 2) {
    patterns.push({
      name: '杀破狼格',
      level: 'good',
      description: '七杀破军贪狼入命三方，为开创进取之命格。主一生变动多、闯荡四方，适合创业、军警、业务等需要冲劲的领域，晚年方能守成。',
      palaces: sanFang.filter(p => getMajorStarNames(p).some(s => shaPo.includes(s))).map(p => p.name),
    });
  }

  // ── 3. 机月同梁 ──────────────────────────────────────────
  const jiyueliang = ['天机', '太阴', '天同', '天梁'];
  const jiyuliangInSanFang = jiyueliang.filter(s => sanFangStars.includes(s));
  if (jiyuliangInSanFang.length >= 3) {
    patterns.push({
      name: '机月同梁格',
      level: 'good',
      description: '天机太阴天同天梁聚于命迁财官，主人聪慧善谋、文质彬彬，适合公职、学术、文艺、服务业，稳定求发展为上策。',
      palaces: sanFang.filter(p => getMajorStarNames(p).some(s => jiyueliang.includes(s))).map(p => p.name),
    });
  }

  // ── 4. 廉贞天相 ──────────────────────────────────────────
  const lianPalace = findStarPalace(chart, '廉贞');
  const xianPalace = findStarPalace(chart, '天相');
  if (lianPalace && xianPalace && lianPalace.branch === xianPalace.branch) {
    patterns.push({
      name: '廉贞天相格',
      level: 'good',
      description: '廉贞天相同宫，印绶格局，主人秉公处事，宜任公职或行政管理职务，有清廉之名，贵人相助。',
      palaces: [lianPalace.name],
    });
  }

  // ── 5. 武曲七杀 ──────────────────────────────────────────
  const wuPalace = findStarPalace(chart, '武曲');
  const qishaPalace = findStarPalace(chart, '七杀');
  if (wuPalace && qishaPalace && wuPalace.branch === qishaPalace.branch) {
    const inMingSanFang = sanFang.some(p => p.branch === wuPalace.branch);
    patterns.push({
      name: '武曲七杀',
      level: inMingSanFang ? 'excellent' : 'good',
      description: '武曲七杀同宫，将星配财星，主人果决刚毅、理财能力强，适合金融、军警、创业，一生奋斗中积财。',
      palaces: [wuPalace.name],
    });
  }

  // ── 6. 天同天梁 ──────────────────────────────────────────
  const tongPalace = findStarPalace(chart, '天同');
  const liangPalace = findStarPalace(chart, '天梁');
  if (tongPalace && liangPalace && tongPalace.branch === liangPalace.branch) {
    patterns.push({
      name: '天同天梁格',
      level: 'good',
      description: '天同天梁同宫，主人宽厚和善，乐于助人，宜从事医疗、教育、宗教、社会公益等荫庇他人的行业。',
      palaces: [tongPalace.name],
    });
  }

  // ── 7. 日月同宫/对拱 ──────────────────────────────────────
  const sunPalace = findStarPalace(chart, '太阳');
  const moonPalace = findStarPalace(chart, '太阴');
  if (sunPalace && moonPalace) {
    if (sunPalace.branch === moonPalace.branch) {
      patterns.push({
        name: '日月同宫',
        level: 'good',
        description: '太阳太阴同宫，光华映照，主人阴阳平衡，文武兼备，异性缘佳，事业顺遂，名声远播。',
        palaces: [sunPalace.name],
      });
    } else if ((sunPalace.branch + 6) % 12 === moonPalace.branch) {
      // 日月对拱
      const inMing = sunPalace.branch === chart.mingGongBranch || moonPalace.branch === chart.mingGongBranch;
      if (inMing) {
        patterns.push({
          name: '日月夹命',
          level: 'excellent',
          description: '太阳太阴分居命宫两侧夹照，光明磊落，一生贵人相助，事业蓬勃，男主官贵，女主旺夫兴家。',
          palaces: [sunPalace.name, moonPalace.name],
        });
      }
    }
  }

  // ── 8. 紫微命宫 ──────────────────────────────────────────
  if (mingStars.includes('紫微') && !mingStars.includes('天府')) {
    patterns.push({
      name: '紫微入命',
      level: 'excellent',
      description: '紫微独坐命宫，帝王之星，主人有领导魅力、自尊心强，适合独当一面，一生孤高自傲但有贵气。',
      palaces: ['命宫'],
    });
  }

  // ── 9. 贪狼化禄 ──────────────────────────────────────────
  const tanPalace = findStarPalace(chart, '贪狼');
  if (tanPalace) {
    const tanStar = tanPalace.stars.find(s => s.name === '贪狼');
    if (tanStar?.siHua === '禄') {
      patterns.push({
        name: '贪狼化禄',
        level: tanPalace.branch === chart.mingGongBranch ? 'excellent' : 'good',
        description: '贪狼化禄，桃花带财，主人魅力出众、才艺多样，人际关系极佳，因人得财，事业多由人脉拓展。',
        palaces: [tanPalace.name],
      });
    }
  }

  // ── 10. 化忌入命/迁 ────────────────────────────────────
  const qianBranch = (chart.mingGongBranch + 6) % 12;
  for (const palace of chart.palaces) {
    if (palace.branch === chart.mingGongBranch || palace.branch === qianBranch) {
      const jiStar = palace.stars.find(s => s.siHua === '忌' && s.type === 'major');
      if (jiStar) {
        patterns.push({
          name: `${jiStar.name}化忌入${palace.name.replace('宫', '')}`,
          level: 'caution',
          description: `${jiStar.name}化忌坐${palace.name}，需留意${
            palace.branch === chart.mingGongBranch
              ? '自身个性上的固执或心理障碍，凡事宜退一步思考'
              : '外出、异地、人际关系上的波折，宜守不宜动'
          }。化忌不一定坏，代表此星的能量需要特别关注。`,
          palaces: [palace.name],
        });
      }
    }
  }

  // ── 11. 左辅右弼夹命 ──────────────────────────────────
  const zuoPalace = chart.palaces.find(p => p.stars.some(s => s.name === '左辅'));
  const youPalace = chart.palaces.find(p => p.stars.some(s => s.name === '右弼'));
  if (zuoPalace && youPalace) {
    const mingB = chart.mingGongBranch;
    const left = (mingB + 1) % 12;
    const right = (mingB + 11) % 12;
    if (
      (zuoPalace.branch === left && youPalace.branch === right) ||
      (youPalace.branch === left && zuoPalace.branch === right)
    ) {
      patterns.push({
        name: '辅弼夹命',
        level: 'excellent',
        description: '左辅右弼夹辅命宫，一生贵人不断，逢凶化吉，遇难成祥，适合走仕途或大企业，有贵人提携之命。',
        palaces: ['命宫', zuoPalace.name, youPalace.name],
      });
    }
  }

  return patterns;
}

// 获取命宫核心关键词（用于摘要显示）
export function getMingGongSummary(chart: ZiweiChart): {
  stars: string[];
  keywords: string[];
  nature: string;
} {
  const mingPalace = chart.palaces.find(p => p.branch === chart.mingGongBranch);
  if (!mingPalace) return { stars: [], keywords: [], nature: '' };

  const majorStars = mingPalace.stars.filter(s => s.type === 'major');
  const starNames = majorStars.map(s => s.name);

  const keywordMap: Record<string, string[]> = {
    '紫微': ['尊贵', '独立', '领导'],
    '天机': ['智慧', '机变', '善谋'],
    '太阳': ['阳刚', '官贵', '慷慨'],
    '武曲': ['财富', '刚毅', '果断'],
    '天同': ['温和', '享福', '随缘'],
    '廉贞': ['才艺', '桃花', '多变'],
    '天府': ['财库', '稳重', '保守'],
    '太阴': ['柔美', '财富', '细腻'],
    '贪狼': ['欲望', '桃花', '多才'],
    '巨门': ['善辩', '多思', '口才'],
    '天相': ['辅佐', '行政', '稳健'],
    '天梁': ['荫护', '医药', '长辈'],
    '七杀': ['将星', '果决', '孤克'],
    '破军': ['开创', '变动', '破旧'],
  };

  const natureMap: Record<string, string> = {
    '紫微': '帝王星', '天机': '智慧星', '太阳': '贵人星',
    '武曲': '财帛星', '天同': '福德星', '廉贞': '桃花星',
    '天府': '财库星', '太阴': '财富星', '贪狼': '桃花星',
    '巨门': '是非星', '天相': '印绶星', '天梁': '荫庇星',
    '七杀': '将帅星', '破军': '变动星',
  };

  const keywords = starNames.flatMap(n => keywordMap[n] ?? []).slice(0, 5);
  const nature = starNames.length > 0 ? (natureMap[starNames[0]] ?? '') : '空宫';

  return { stars: starNames, keywords, nature };
}
