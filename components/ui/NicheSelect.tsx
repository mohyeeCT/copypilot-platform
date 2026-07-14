'use client'
import CustomSelect, { type CustomSelectSize } from './CustomSelect'

interface Niche {
  key: string
  label: string
  group: string
  business_types: string[]
}

const NICHES: Niche[] = [
  { key: 'none', label: 'No specific niche', group: 'General', business_types: ['b2b','b2c','ecommerce','service','local','general'] },
  // B2B
  { key: 'manufacturing_industrial', label: 'Manufacturing / Industrial', group: 'B2B', business_types: ['b2b','general'] },
  { key: 'saas_software',            label: 'SaaS / Software',            group: 'B2B', business_types: ['b2b','general'] },
  { key: 'financial_services',       label: 'Financial Services / Fintech', group: 'B2B', business_types: ['b2b','general'] },
  { key: 'it_msp',                   label: 'IT / MSP',                   group: 'B2B', business_types: ['b2b','service','general'] },
  { key: 'professional_services',    label: 'Professional Services / Consulting', group: 'B2B', business_types: ['b2b','service','general'] },
  { key: 'hr_recruitment',           label: 'HR / Recruitment',           group: 'B2B', business_types: ['b2b','service','general'] },
  { key: 'logistics_supply_chain',   label: 'Logistics / Supply Chain',   group: 'B2B', business_types: ['b2b','general'] },
  // Service / Local
  { key: 'law_firm',         label: 'Law Firm / Legal Services',    group: 'Service / Local', business_types: ['service','local','b2b','general'] },
  { key: 'dental_medical',   label: 'Dental / Medical Practice',    group: 'Service / Local', business_types: ['service','local','general'] },
  { key: 'hvac_trades',      label: 'HVAC / Plumbing / Trades',     group: 'Service / Local', business_types: ['service','local','general'] },
  { key: 'real_estate',      label: 'Real Estate / Property',       group: 'Service / Local', business_types: ['service','local','b2b','general'] },
  { key: 'accountancy_tax',  label: 'Accountancy / Tax',            group: 'Service / Local', business_types: ['service','local','b2b','general'] },
  { key: 'fitness_wellness', label: 'Fitness / Wellness',           group: 'Service / Local', business_types: ['service','local','b2c','general'] },
  { key: 'childcare_education', label: 'Childcare / Education',     group: 'Service / Local', business_types: ['service','local','general'] },
  { key: 'marketing_agency', label: 'Marketing Agency / Creative',  group: 'Service / Local', business_types: ['service','b2b','general'] },
  // Ecommerce
  { key: 'fashion_apparel',       label: 'Fashion / Apparel',         group: 'Ecommerce', business_types: ['ecommerce','b2c','general'] },
  { key: 'beauty_skincare',       label: 'Beauty / Skincare',         group: 'Ecommerce', business_types: ['ecommerce','b2c','general'] },
  { key: 'home_garden',           label: 'Home & Garden',             group: 'Ecommerce', business_types: ['ecommerce','b2c','general'] },
  { key: 'sports_outdoors',       label: 'Sports / Outdoors',         group: 'Ecommerce', business_types: ['ecommerce','b2c','general'] },
  { key: 'food_beverage',         label: 'Food & Beverage',           group: 'Ecommerce', business_types: ['ecommerce','b2c','general'] },
  { key: 'electronics_tech',      label: 'Electronics / Consumer Tech', group: 'Ecommerce', business_types: ['ecommerce','b2c','general'] },
  { key: 'supplements_nutrition', label: 'Supplements / Nutrition',   group: 'Ecommerce', business_types: ['ecommerce','b2c','general'] },
]

interface NicheSelectProps {
  value: string
  onChange: (value: string) => void
  businessType?: string
  label?: string
  size?: CustomSelectSize
}

export default function NicheSelect({ value, onChange, businessType = '', label = 'Niche', size = 'default' }: NicheSelectProps) {
  const filtered = NICHES.filter(n =>
    !businessType || n.key === 'none' || n.business_types.includes(businessType)
  )

  return (
    <div>
      <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">{label}</label>
      <CustomSelect value={value} onChange={onChange}
        options={filtered.map(n => ({ value: n.key, label: n.label, group: n.group }))}
        size={size} />
      {value && value !== 'none' && (
        <p className="text-xs text-muted mt-1">
          Industry-specific context will be injected into every prompt for this job.
        </p>
      )}
    </div>
  )
}
