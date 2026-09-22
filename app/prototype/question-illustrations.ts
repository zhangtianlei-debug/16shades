import illustrationFits from './question-illustration-fit.json';

// Context-only artwork: these mappings never depend on a selected answer.
export const questionIllustrations: Partial<Record<string, string>> = {
  G01: 'q01-g01',
  M01: 'q02-m01',
  H01: 'q03-h01',
  N01: 'q04-n01',
  G17: 'q05-g17',
  M17: 'q06-m17',
  H17: 'q07-h17',
  N17: 'q08-n17',
  G30: 'q09-g30',
  M30: 'q10-m30',
  H30: 'q11-h30',
  N30: 'q12-n30',
  G02: 'q13-g02',
  M02: 'q14-m02',
  H02: 'q15-h02',
  N02: 'q16-n02',
  G29: 'q17-g29',
  M24: 'q18-m24',
  H39: 'q19-h39',
  N40: 'q20-n40',
  G37: 'q21-g37',
  M37: 'q22-m37',
  H35: 'q23-h35',
  N25: 'q24-n25',
  G08: 'q25-g08',
  M38: 'q26-m38',
  H20: 'q27-h20',
  N24: 'q28-n24',
  G20: 'q29-g20',
  M15: 'q30-m15',
  H03: 'q31-h03',
  N28: 'q32-n28',
  G22: 'q33-g22',
  M22: 'q34-m22',
  H22: 'q35-h22',
  N15: 'q36-n15',
  G03: 'q37-g03',
  M33: 'q38-m33',
  H40: 'q39-h40',
  N35: 'q40-n35',
  G21: 'q41-g21',
  M19: 'q42-m19',
  H25: 'q43-h25',
  N06: 'q44-n06',
  G32: 'q45-g32',
  M12: 'q46-m12',
  H14: 'q47-h14',
  N31: 'q48-n31',
};

export const sharedIllustrationSrc =
  '/question-illustrations/brand-frosted-v1.webp';

export function questionIllustrationSrc(id: string): string {
  const name = questionIllustrations[id];
  return name ? `/question-illustrations/${name}.webp` : sharedIllustrationSrc;
}

// Taller still lifes need a smaller canvas so the fixed-height slot keeps
// every object visible. Original artwork and the first 16 layouts stay intact.
export function questionIllustrationStyle(src: string, review = false) {
  const fit = (illustrationFits as Partial<Record<string, number>>)[src];
  if (!fit) return undefined;
  return {
    width: review ? `min(100cqw, ${fit}cqh)` : `min(88cqw, ${fit}cqh, 360px)`,
  };
}
