// The ring is two sibling rings: the Good Idea Factory and the Bad Idea
// Factory. Each member belongs to one, and a visitor walking prev / next /
// random never crosses over. A member with no factory set is good.

export const FACTORIES = ['good', 'bad'];

export function factoryOf(member) {
  return member?.factory === 'bad' ? 'bad' : 'good';
}

// A factory named in a query string or form, or null when it names neither.
export function parseFactory(value) {
  return FACTORIES.includes(value) ? value : null;
}

export function otherFactory(factory) {
  return factory === 'bad' ? 'good' : 'bad';
}

export const FACTORY_DEFAULTS = {
  good: { name: 'Good Idea Factory', description: '' },
  bad: { name: 'Bad Idea Factory', description: '' },
};

// Names and descriptions from ring.json, falling back to the defaults above.
export function factoriesOf(ring) {
  const out = {};
  for (const f of FACTORIES) out[f] = { ...FACTORY_DEFAULTS[f], ...(ring?.factories?.[f] || {}) };
  return out;
}
