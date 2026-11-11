'use strict';

// 统一内容安全过滤：服务端为唯一裁决方，客户端只负责展示结果。
// 通过对 Unicode、同形字、拆字符号、数字替代与重复字符归一化，
// 降低“傻 逼”“sh1t”“a$$hole”“fuuuck”等规避写法的漏检率。

const MAX_SCAN_LENGTH = 512;
const SEPARATOR = '[\\s\\p{P}\\p{S}]*';

const HOMOGLYPHS = new Map([
  ['а', 'a'], ['в', 'b'], ['с', 'c'], ['е', 'e'], ['һ', 'h'], ['і', 'i'],
  ['ј', 'j'], ['к', 'k'], ['м', 'm'], ['н', 'h'], ['о', 'o'], ['р', 'p'],
  ['ѕ', 's'], ['т', 't'], ['у', 'y'], ['х', 'x'], ['ԁ', 'd'], ['ɡ', 'g'],
  ['α', 'a'], ['β', 'b'], ['ε', 'e'], ['ι', 'i'], ['κ', 'k'], ['ο', 'o'],
  ['ρ', 'p'], ['τ', 't'], ['υ', 'u'], ['χ', 'x'], ['ν', 'v']
]);

const ASCII_ALIASES = new Map([
  ['0', 'o'], ['1', 'i'], ['3', 'e'], ['4', 'a'], ['5', 's'],
  ['6', 'g'], ['7', 't'], ['8', 'b'], ['9', 'g'], ['@', 'a'],
  ['$', 's'], ['!', 'i'], ['|', 'l'], ['+', 't']
]);

const GROUPS = [
  {
    category: 'profanity',
    terms: [
      'ass', 'arse', 'arsehole', 'asshat', 'asshole', 'assholes', 'asswipe',
      'bastard', 'bastards', 'biatch', 'bitch', 'bitches', 'bollocks',
      'bullshit', 'cock', 'cocksucker', 'crap', 'cunt', 'cunts', 'damn',
      'dick', 'dickhead', 'dipshit', 'douche', 'douchebag', 'dumbass', 'fack',
      'fck', 'fking', 'fkn', 'fuck', 'fucked', 'fucker', 'fuckers', 'fuckface',
      'fucking', 'fuckwit', 'fuk', 'fuq', 'fuxk', 'fvck', 'goddamn', 'idiot',
      'idiots', 'imbecile', 'jackass', 'moron', 'motherfucker', 'motherfuckers',
      'motherfucking', 'phuck', 'phuk', 'prick', 'pussy', 'retard', 'retarded',
      'scumbag', 'shit', 'shite', 'shithead', 'shitty', 'slut', 'stfu', 'twat',
      'wank', 'wanker', 'whore', 'wtf'
    ]
  },
  {
    category: 'sexual',
    terms: [
      'hentai', 'incest', 'molest', 'nsfw', 'nude', 'nudes', 'pedo', 'pedophile',
      'porn', 'porno', 'pornography', 'rape', 'raped', 'rapist'
    ]
  },
  {
    category: 'hate',
    terms: [
      'chink', 'fag', 'faggot', 'hitler', 'kike', 'nazi', 'nigga', 'nigger',
      'spic', 'terrorist', 'tranny', 'wetback', '纳粹', '恐怖分子'
    ]
  },
  {
    category: 'violence',
    terms: ['kys']
  },
  {
    category: 'evasion',
    terms: [
      'caonima', 'cnm', 'jiba', 'mdzz', 'mlgb', 'mmp', 'nmb', 'nmd', 'nmlgb',
      'nmsl', 'qnm', 'rnm', 'sabi', 'sb', 'shab', 'shabi', 'tmd', 'wcnm'
    ]
  },
  {
    category: 'profanity-zh',
    terms: [
      '傻逼', '傻屄', '傻屌', '傻吊', '傻鸟', '傻批', '傻叉', '傻缺', '傻x逼',
      '煞笔', '沙比',
      '操你妈', '操你媽', '操你', '草泥马', '草你妈', '艹你妈', '日你妈', '干你娘',
      '幹你娘', '你妈逼', '你媽逼', '你妈死了', '你媽死了', '尼玛', '尼玛的',
      '你麻痹', '妈了个逼', '妈个逼', '妈的', '他妈的', '她妈的', '你妈的',
      '卧槽', '我操你', '婊子', '贱人', '贱货', '贱骨头', '骚货', '浪货', '荡妇',
      '妓女', '母狗', '狗娘养', '王八蛋', '混蛋', '畜生', '杂种', '雜種', '狗东西',
      '死全家', '全家死光', '断子绝孙', '去死', '滚蛋', '杀了你', '弄死你',
      '打死你', '砍死你', '狗日的', '妈卖批', '他娘的', '白痴', '智障', '脑残',
      '腦殘', '弱智', '鸡巴', '雞巴', '傻b'
    ]
  },
  {
    category: 'sexual-zh',
    terms: [
      '色情', '黄片', '黃片', '黄图', '黃圖', '裸聊', '裸照', '约炮', '約炮',
      '卖淫', '賣淫', '嫖娼', '强奸', '強姦', '轮奸', '輪姦', '做爱', '做愛',
      '口交', '性交', '三级片', '三級片', '淫秽', '淫穢', '阴道', '陰道',
      '阴茎', '陰莖'
    ]
  }
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(raw) {
  let text = String(raw == null ? '' : raw);
  if (!text) return '';

  try {
    text = text.normalize('NFKC');
    text = text.normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC');
  } catch (err) {
    // 极旧运行时没有 Unicode 归一化时仍继续做字符级清洗。
  }

  text = text.toLowerCase();
  text = text.replace(/[\u0000-\u001f\u007f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '');

  let normalized = '';
  for (const char of text) {
    const homoglyph = HOMOGLYPHS.get(char);
    if (homoglyph) {
      normalized += homoglyph;
      continue;
    }
    const alias = ASCII_ALIASES.get(char);
    normalized += alias || char;
  }
  return normalized.slice(0, MAX_SCAN_LENGTH);
}

function buildRule(term) {
  const asciiOnly = /^[a-z0-9]+$/.test(term);
  // 四字母以上的英文词允许用符号占位替换单个字母，例如 f*ck、motherf**ker；
  // 短词不做占位放宽，避免把正常缩写或标点组合误判。
  const allowPlaceholder = asciiOnly && term.length >= 4;
  const body = Array.from(term)
    .map((char) => {
      const escaped = escapeRegExp(char);
      return allowPlaceholder
        ? '(?:' + escaped + '+|[\\s\\p{P}\\p{S}]+)'
        : escaped + '+';
    })
    .join(SEPARATOR);
  const pattern = asciiOnly
    ? '(?<![a-z0-9])' + body + '(?![a-z0-9])'
    : body;
  return new RegExp(pattern, 'u');
}

const RULES = GROUPS.flatMap((group) => group.terms.map((term) => ({
  category: group.category,
  regex: buildRule(term)
})));

const CATEGORIES = [...new Set(GROUPS.map((group) => group.category))];

function inspect(raw) {
  const categories = [];
  const normalized = normalize(raw);
  if (normalized) {
    for (const rule of RULES) {
      if (categories.includes(rule.category)) continue;
      if (rule.regex.test(normalized)) categories.push(rule.category);
    }
  }
  return {
    blocked: categories.length > 0,
    categories
  };
}

function isBlocked(raw) {
  return inspect(raw).blocked;
}

function descriptor() {
  return {
    enabled: true,
    names: true,
    chat: true,
    evasionResistant: true,
    categories: CATEGORIES.slice()
  };
}

module.exports = {
  normalize,
  inspect,
  isBlocked,
  descriptor
};
