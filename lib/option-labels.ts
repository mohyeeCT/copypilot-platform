export const OPTION_LABELS: Record<string, string> = {
  general: 'General',
  b2b: 'B2B',
  b2c: 'B2C',
  ecommerce: 'Ecommerce',
  service: 'Service',
  local: 'Local',
  category: 'Category',
  product: 'Product',
  location: 'Location',
  blog: 'Blog',
  brand: 'Brand',
  case_study: 'Case Study',
  glossary: 'Glossary',
  homepage: 'Homepage',
  about: 'About',
  contact: 'Contact',
  collection: 'Collection',
}

export function displayOptionLabel(value: string): string {
  return OPTION_LABELS[value] ?? value
}

export function toDisplayOptions(values: string[]) {
  return values.map(value => ({ value, label: displayOptionLabel(value) }))
}
