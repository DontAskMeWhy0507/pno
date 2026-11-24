export type IeltsSkillSlug = 'reading' | 'listening' | 'writing' | 'speaking';

export type IeltsHomeRoute =
  | { tab: 'collections'; collectionName?: string; skill?: 'all' | IeltsSkillSlug }
  | { tab: 'test_detail'; skill: IeltsSkillSlug; examId: string }
  | { tab: 'history' }
  | {
      tab: 'manage';
      subTab: 'tests' | 'collections';
      action?: 'smart_import' | 'new_collection';
    };

export type IeltsParsedLocation =
  | { view: 'exam'; skill: 'reading' | 'listening'; examId: string; partNumber?: number }
  | { view: 'writing'; examId: string }
  | { view: 'speaking'; examId: string }
  | { view: 'home'; home: IeltsHomeRoute };

const VALID_SKILLS = new Set<IeltsSkillSlug>(['reading', 'listening', 'writing', 'speaking']);

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function parseIeltsLocation(pathname: string, search = ''): IeltsParsedLocation {
  const cleanPath = (pathname || '/ielts').replace(/^\/ielts\/?/, '/');
  const segments = cleanPath.split('/').filter(Boolean);
  const first = (segments[0] || '').toLowerCase();
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  // Active exam rooms
  if ((first === 'reading' || first === 'listening') && segments[1]) {
    const examId = safeDecode(segments[1]);
    const maybePart = Number(segments[3]);
    return {
      view: 'exam',
      skill: first,
      examId,
      partNumber: Number.isFinite(maybePart) && maybePart > 0 ? maybePart : undefined,
    };
  }

  if (first === 'writing' && segments[1]) {
    return { view: 'writing', examId: safeDecode(segments[1]) };
  }

  if (first === 'speaking' && segments[1]) {
    return { view: 'speaking', examId: safeDecode(segments[1]) };
  }

  // Home sub-URLs
  if (first === 'history') {
    return { view: 'home', home: { tab: 'history' } };
  }

  if (first === 'manage') {
    const second = (segments[1] || 'tests').toLowerCase();
    const rawAction = params.get('action');
    const action =
      rawAction === 'smart_import' || rawAction === 'new_collection' ? rawAction : undefined;
    return {
      view: 'home',
      home: {
        tab: 'manage',
        subTab: second === 'collections' ? 'collections' : 'tests',
        action,
      },
    };
  }

  if (first === 'test' && segments[1] && segments[2]) {
    const rawSkill = segments[1].toLowerCase() as IeltsSkillSlug;
    if (VALID_SKILLS.has(rawSkill)) {
      return {
        view: 'home',
        home: {
          tab: 'test_detail',
          skill: rawSkill,
          examId: safeDecode(segments[2]),
        },
      };
    }
  }

  if (first === 'collections') {
    const collectionName = segments[1] ? safeDecode(segments[1]) : undefined;
    const rawSkill = (params.get('skill') || '').toLowerCase();
    const skill =
      rawSkill === 'all' || VALID_SKILLS.has(rawSkill as IeltsSkillSlug)
        ? (rawSkill as 'all' | IeltsSkillSlug)
        : undefined;
    return {
      view: 'home',
      home: {
        tab: 'collections',
        collectionName,
        skill,
      },
    };
  }

  return {
    view: 'home',
    home: { tab: 'collections' },
  };
}

export function buildIeltsHomePath(home: IeltsHomeRoute): string {
  if (home.tab === 'history') {
    return '/ielts/history';
  }
  if (home.tab === 'manage') {
    const base =
      home.subTab === 'collections' ? '/ielts/manage/collections' : '/ielts/manage/tests';
    return home.action ? `${base}?action=${home.action}` : base;
  }
  if (home.tab === 'test_detail') {
    return `/ielts/test/${home.skill}/${encodeURIComponent(home.examId)}`;
  }
  if (home.collectionName) {
    const base = `/ielts/collections/${encodeURIComponent(home.collectionName)}`;
    return home.skill && home.skill !== 'all' ? `${base}?skill=${home.skill}` : base;
  }
  return '/ielts/collections';
}

export function pushIeltsHistory(path: string, replace = false): void {
  if (typeof window === 'undefined') return;
  const current = window.location.pathname + window.location.search;
  if (current === path) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
}
