// ============================================
// icd10_migration.mjs
// Run: node icd10_migration.mjs  (from backend/)
//
// Seeds ~400 most common ICD-10 codes for
// Nigerian primary & secondary care.
// Covers: malaria, typhoid, hypertension, diabetes,
// respiratory, maternity, trauma, mental health, etc.
// ============================================
import { query } from './src/config/database.js';

console.log('🏥 Running ICD-10 migration...\n');

await query(`
  CREATE TABLE IF NOT EXISTS icd10_codes (
    code        TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    category    TEXT NOT NULL,
    chapter     TEXT,
    is_active   INTEGER DEFAULT 1
  )
`).then(() => console.log('  ✅ icd10_codes table'))
  .catch(e => console.log('  ⏭  icd10_codes:', e.message.split('\n')[0]));

await query('CREATE INDEX IF NOT EXISTS idx_icd_cat  ON icd10_codes(category)');
await query('CREATE INDEX IF NOT EXISTS idx_icd_desc ON icd10_codes(description)');

// Also ensure consultations table has icd_codes column (JSON array for multi-coding)
const cols = [
  "ALTER TABLE consultations ADD COLUMN icd_codes TEXT",        // JSON array of {code, description}
  "ALTER TABLE consultations ADD COLUMN primary_icd_code TEXT", // primary diagnosis code
  "ALTER TABLE consultations ADD COLUMN secondary_icd_codes TEXT", // secondary codes JSON
];
for (const sql of cols) {
  await query(sql).catch(e => {
    if (!e.message?.includes('duplicate column')) console.warn('  ⚠️ ', e.message.split('\n')[0]);
  });
}
console.log('  ✅ consultations columns verified');

// ── ICD-10 codes seed ─────────────────────────────────────────────────────────
// Format: [code, description, category]
const codes = [
  // ── INFECTIOUS & PARASITIC ────────────────────────────────────────────────
  ['A00',   'Cholera',                                                    'Infectious'],
  ['A01.0', 'Typhoid fever',                                              'Infectious'],
  ['A01.1', 'Paratyphoid fever A',                                        'Infectious'],
  ['A02.0', 'Salmonella enteritis',                                       'Infectious'],
  ['A06.0', 'Acute amoebic dysentery',                                    'Infectious'],
  ['A09',   'Diarrhoea and gastroenteritis of infectious origin',         'Infectious'],
  ['A15.0', 'Tuberculosis of lung',                                       'Infectious'],
  ['A16.2', 'Tuberculosis of lung without mention of bacteriological confirmation', 'Infectious'],
  ['A37.0', 'Whooping cough due to Bordetella pertussis',                 'Infectious'],
  ['A46',   'Erysipelas',                                                 'Infectious'],
  ['A48.1', 'Legionnaires disease',                                       'Infectious'],
  ['A49.0', 'Staphylococcal infection, unspecified',                      'Infectious'],
  ['A49.1', 'Streptococcal infection, unspecified',                       'Infectious'],
  ['A74.9', 'Chlamydial infection, unspecified',                          'Infectious'],
  ['A87.0', 'Enteroviral meningitis',                                     'Infectious'],
  ['A90',   'Dengue fever',                                               'Infectious'],
  ['A91',   'Dengue haemorrhagic fever',                                  'Infectious'],
  ['B00.0', 'Eczema herpeticum',                                          'Infectious'],
  ['B00.1', 'Herpesviral vesicular dermatitis',                           'Infectious'],
  ['B01.9', 'Varicella (chickenpox) without complications',               'Infectious'],
  ['B02.9', 'Zoster without complications (shingles)',                    'Infectious'],
  ['B05.9', 'Measles without complications',                              'Infectious'],
  ['B06.9', 'Rubella without complications',                              'Infectious'],
  ['B15.9', 'Acute hepatitis A without hepatic coma',                     'Infectious'],
  ['B16.9', 'Acute hepatitis B without mention of delta-agent and without hepatic coma', 'Infectious'],
  ['B18.1', 'Chronic viral hepatitis B',                                  'Infectious'],
  ['B18.2', 'Chronic viral hepatitis C',                                  'Infectious'],
  ['B20',   'HIV disease resulting in infectious and parasitic diseases', 'Infectious'],
  ['B24',   'HIV disease, unspecified',                                   'Infectious'],
  ['B50.0', 'Plasmodium falciparum malaria with cerebral complications',  'Infectious'],
  ['B50.9', 'Plasmodium falciparum malaria, unspecified',                 'Infectious'],
  ['B51.9', 'Plasmodium vivax malaria without complications',             'Infectious'],
  ['B54',   'Unspecified malaria',                                        'Infectious'],
  ['B55.1', 'Cutaneous leishmaniasis',                                    'Infectious'],
  ['B65.1', 'Intestinal schistosomiasis due to Schistosoma mansoni',     'Infectious'],
  ['B73',   'Onchocerciasis (river blindness)',                           'Infectious'],
  ['B74.0', 'Filariasis due to Wuchereria bancrofti',                    'Infectious'],
  ['B76.0', 'Ancylostomiasis (hookworm)',                                  'Infectious'],
  ['B77.9', 'Ascariasis, unspecified',                                    'Infectious'],
  ['B82.9', 'Intestinal parasitism, unspecified',                         'Infectious'],

  // ── NEOPLASMS ─────────────────────────────────────────────────────────────
  ['C15.9', 'Malignant neoplasm of oesophagus, unspecified',             'Neoplasm'],
  ['C16.9', 'Malignant neoplasm of stomach, unspecified',                'Neoplasm'],
  ['C18.9', 'Malignant neoplasm of colon, unspecified',                  'Neoplasm'],
  ['C22.0', 'Hepatocellular carcinoma',                                  'Neoplasm'],
  ['C34.9', 'Malignant neoplasm of bronchus and lung, unspecified',      'Neoplasm'],
  ['C43.9', 'Malignant melanoma of skin, unspecified',                   'Neoplasm'],
  ['C50.9', 'Malignant neoplasm of breast, unspecified',                 'Neoplasm'],
  ['C53.9', 'Malignant neoplasm of cervix uteri, unspecified',           'Neoplasm'],
  ['C61',   'Malignant neoplasm of prostate',                            'Neoplasm'],
  ['C67.9', 'Malignant neoplasm of bladder, unspecified',               'Neoplasm'],
  ['C80.1', 'Malignant neoplasm, primary site unspecified',             'Neoplasm'],
  ['C92.0', 'Acute myeloblastic leukaemia',                             'Neoplasm'],
  ['D25.9', 'Leiomyoma of uterus, unspecified (fibroid)',               'Neoplasm'],
  ['D50.0', 'Iron deficiency anaemia secondary to blood loss',          'Blood'],
  ['D50.9', 'Iron deficiency anaemia, unspecified',                      'Blood'],
  ['D51.0', 'Vitamin B12 deficiency anaemia due to intrinsic factor deficiency', 'Blood'],
  ['D57.0', 'Sickle-cell anaemia with crisis',                          'Blood'],
  ['D57.1', 'Sickle-cell anaemia without crisis',                       'Blood'],
  ['D64.9', 'Anaemia, unspecified',                                      'Blood'],

  // ── ENDOCRINE & METABOLIC ─────────────────────────────────────────────────
  ['E03.9', 'Hypothyroidism, unspecified',                               'Endocrine'],
  ['E05.9', 'Thyrotoxicosis, unspecified (hyperthyroidism)',             'Endocrine'],
  ['E10.9', 'Insulin-dependent diabetes mellitus without complications (Type 1)', 'Endocrine'],
  ['E11.0', 'Type 2 diabetes mellitus with coma',                       'Endocrine'],
  ['E11.2', 'Type 2 diabetes mellitus with kidney complications',       'Endocrine'],
  ['E11.3', 'Type 2 diabetes mellitus with ophthalmic complications',   'Endocrine'],
  ['E11.5', 'Type 2 diabetes mellitus with peripheral circulatory complications', 'Endocrine'],
  ['E11.9', 'Type 2 diabetes mellitus without complications',            'Endocrine'],
  ['E14',   'Unspecified diabetes mellitus',                             'Endocrine'],
  ['E40',   'Kwashiorkor',                                               'Endocrine'],
  ['E41',   'Nutritional marasmus',                                      'Endocrine'],
  ['E43',   'Unspecified severe protein-energy malnutrition',            'Endocrine'],
  ['E46',   'Unspecified protein-energy malnutrition',                   'Endocrine'],
  ['E55.9', 'Vitamin D deficiency, unspecified',                         'Endocrine'],
  ['E58',   'Dietary calcium deficiency',                                'Endocrine'],
  ['E66.9', 'Obesity, unspecified',                                      'Endocrine'],
  ['E78.0', 'Pure hypercholesterolaemia',                                'Endocrine'],
  ['E78.5', 'Hyperlipidaemia, unspecified',                              'Endocrine'],
  ['E83.5', 'Disorders of calcium metabolism',                           'Endocrine'],
  ['E86',   'Volume depletion (dehydration)',                            'Endocrine'],

  // ── MENTAL HEALTH ─────────────────────────────────────────────────────────
  ['F10.1', 'Mental and behavioural disorders due to alcohol - harmful use', 'Mental Health'],
  ['F20.0', 'Paranoid schizophrenia',                                    'Mental Health'],
  ['F20.9', 'Schizophrenia, unspecified',                                'Mental Health'],
  ['F25.0', 'Schizoaffective disorder, manic type',                     'Mental Health'],
  ['F31.9', 'Bipolar affective disorder, unspecified',                   'Mental Health'],
  ['F32.0', 'Mild depressive episode',                                   'Mental Health'],
  ['F32.1', 'Moderate depressive episode',                               'Mental Health'],
  ['F32.2', 'Severe depressive episode without psychotic symptoms',     'Mental Health'],
  ['F32.9', 'Depressive episode, unspecified',                          'Mental Health'],
  ['F33.9', 'Recurrent depressive disorder, unspecified',               'Mental Health'],
  ['F40.1', 'Social phobias',                                            'Mental Health'],
  ['F41.0', 'Panic disorder (episodic paroxysmal anxiety)',             'Mental Health'],
  ['F41.1', 'Generalised anxiety disorder',                              'Mental Health'],
  ['F41.9', 'Anxiety disorder, unspecified',                             'Mental Health'],
  ['F43.1', 'Post-traumatic stress disorder (PTSD)',                     'Mental Health'],
  ['F70.9', 'Mild intellectual disability, unspecified',                 'Mental Health'],
  ['F90.0', 'Disturbance of activity and attention (ADHD)',             'Mental Health'],

  // ── NERVOUS SYSTEM ────────────────────────────────────────────────────────
  ['G20',   'Parkinson disease',                                         'Neurological'],
  ['G30.9', "Alzheimer's disease, unspecified",                         'Neurological'],
  ['G35',   'Multiple sclerosis',                                        'Neurological'],
  ['G40.9', 'Epilepsy, unspecified',                                     'Neurological'],
  ['G43.9', 'Migraine, unspecified',                                     'Neurological'],
  ['G44.2', 'Tension-type headache',                                    'Neurological'],
  ['G50.0', 'Trigeminal neuralgia',                                     'Neurological'],
  ['G51.0', "Bell's palsy (facial nerve palsy)",                        'Neurological'],
  ['G54.2', 'Cervical root disorders',                                   'Neurological'],
  ['G62.9', 'Polyneuropathy, unspecified',                               'Neurological'],
  ['G89.0', 'Central pain syndrome',                                    'Neurological'],

  // ── EYE ──────────────────────────────────────────────────────────────────
  ['H10.9', 'Conjunctivitis, unspecified',                              'Eye'],
  ['H25.9', 'Senile cataract, unspecified',                             'Eye'],
  ['H26.9', 'Unspecified cataract',                                     'Eye'],
  ['H40.9', 'Glaucoma, unspecified',                                    'Eye'],
  ['H52.4', 'Presbyopia',                                               'Eye'],
  ['H54.9', 'Visual impairment, unspecified',                           'Eye'],

  // ── EAR ──────────────────────────────────────────────────────────────────
  ['H61.2', 'Impacted cerumen',                                         'Ear'],
  ['H65.9', 'Nonsuppurative otitis media, unspecified',                 'Ear'],
  ['H66.9', 'Otitis media, unspecified',                                'Ear'],
  ['H81.0', "Ménière's disease",                                        'Ear'],
  ['H83.9', 'Disease of inner ear, unspecified',                        'Ear'],
  ['H91.9', 'Hearing loss, unspecified',                                'Ear'],

  // ── CIRCULATORY ──────────────────────────────────────────────────────────
  ['I10',   'Essential (primary) hypertension',                         'Cardiovascular'],
  ['I11.0', 'Hypertensive heart disease with (congestive) heart failure','Cardiovascular'],
  ['I11.9', 'Hypertensive heart disease without (congestive) heart failure','Cardiovascular'],
  ['I12.9', 'Hypertensive renal disease without renal failure',         'Cardiovascular'],
  ['I20.9', 'Angina pectoris, unspecified',                             'Cardiovascular'],
  ['I21.9', 'Acute myocardial infarction, unspecified',                 'Cardiovascular'],
  ['I25.1', 'Atherosclerotic heart disease of native coronary artery',  'Cardiovascular'],
  ['I25.9', 'Chronic ischaemic heart disease, unspecified',             'Cardiovascular'],
  ['I27.0', 'Primary pulmonary hypertension',                           'Cardiovascular'],
  ['I33.0', 'Acute and subacute infective endocarditis',                'Cardiovascular'],
  ['I42.0', 'Dilated cardiomyopathy',                                   'Cardiovascular'],
  ['I48.9', 'Atrial fibrillation and flutter, unspecified',             'Cardiovascular'],
  ['I50.0', 'Congestive heart failure',                                  'Cardiovascular'],
  ['I50.9', 'Heart failure, unspecified',                               'Cardiovascular'],
  ['I63.9', 'Cerebral infarction, unspecified (ischaemic stroke)',      'Cardiovascular'],
  ['I64',   'Stroke, not specified as haemorrhage or infarction',       'Cardiovascular'],
  ['I69.3', 'Sequelae of cerebral infarction',                         'Cardiovascular'],
  ['I70.2', 'Atherosclerosis of arteries of the extremities',          'Cardiovascular'],
  ['I73.0', "Raynaud's syndrome",                                       'Cardiovascular'],
  ['I80.3', 'Phlebitis and thrombophlebitis of lower extremities',      'Cardiovascular'],
  ['I84.9', 'Haemorrhoids, unspecified',                                'Cardiovascular'],

  // ── RESPIRATORY ──────────────────────────────────────────────────────────
  ['J00',   'Acute nasopharyngitis (common cold)',                      'Respiratory'],
  ['J02.9', 'Acute pharyngitis, unspecified (sore throat)',             'Respiratory'],
  ['J03.9', 'Acute tonsillitis, unspecified',                           'Respiratory'],
  ['J04.0', 'Acute laryngitis',                                         'Respiratory'],
  ['J06.9', 'Acute upper respiratory infection, unspecified',           'Respiratory'],
  ['J11.1', 'Influenza with other respiratory manifestations',          'Respiratory'],
  ['J18.0', 'Bronchopneumonia, unspecified',                            'Respiratory'],
  ['J18.9', 'Pneumonia, unspecified',                                   'Respiratory'],
  ['J20.9', 'Acute bronchitis, unspecified',                            'Respiratory'],
  ['J30.4', 'Allergic rhinitis, unspecified',                           'Respiratory'],
  ['J32.9', 'Chronic sinusitis, unspecified',                           'Respiratory'],
  ['J35.0', 'Chronic tonsillitis',                                      'Respiratory'],
  ['J38.4', 'Oedema of larynx',                                        'Respiratory'],
  ['J40',   'Bronchitis, not specified as acute or chronic',            'Respiratory'],
  ['J44.1', 'Chronic obstructive pulmonary disease with acute exacerbation', 'Respiratory'],
  ['J44.9', 'Chronic obstructive pulmonary disease, unspecified (COPD)','Respiratory'],
  ['J45.0', 'Predominantly allergic asthma',                           'Respiratory'],
  ['J45.9', 'Asthma, unspecified',                                     'Respiratory'],
  ['J47',   'Bronchiectasis',                                           'Respiratory'],
  ['J93.9', 'Pneumothorax, unspecified',                               'Respiratory'],
  ['J96.0', 'Acute respiratory failure',                                'Respiratory'],
  ['J98.9', 'Respiratory disorder, unspecified',                        'Respiratory'],

  // ── DIGESTIVE ────────────────────────────────────────────────────────────
  ['K02.9', 'Dental caries, unspecified',                              'Digestive'],
  ['K04.0', 'Pulpitis',                                                'Digestive'],
  ['K05.0', 'Acute gingivitis',                                        'Digestive'],
  ['K21.0', 'Gastro-oesophageal reflux disease with oesophagitis (GERD)','Digestive'],
  ['K21.9', 'Gastro-oesophageal reflux disease without oesophagitis', 'Digestive'],
  ['K22.1', 'Ulcer of oesophagus',                                    'Digestive'],
  ['K25.9', 'Gastric ulcer, unspecified',                             'Digestive'],
  ['K26.9', 'Duodenal ulcer, unspecified',                            'Digestive'],
  ['K29.7', 'Gastritis, unspecified',                                  'Digestive'],
  ['K35.9', 'Acute appendicitis, unspecified',                         'Digestive'],
  ['K37',   'Unspecified appendicitis',                                'Digestive'],
  ['K40.9', 'Unilateral inguinal hernia without obstruction or gangrene','Digestive'],
  ['K43.9', 'Ventral hernia without obstruction or gangrene',          'Digestive'],
  ['K50.9', "Crohn's disease, unspecified",                            'Digestive'],
  ['K52.9', 'Noninfective gastroenteritis and colitis, unspecified',   'Digestive'],
  ['K57.3', 'Diverticulosis of large intestine without perforation or abscess','Digestive'],
  ['K59.0', 'Constipation',                                            'Digestive'],
  ['K59.1', 'Functional diarrhoea',                                    'Digestive'],
  ['K70.3', 'Alcoholic cirrhosis of liver',                            'Digestive'],
  ['K72.9', 'Hepatic failure, unspecified',                            'Digestive'],
  ['K74.6', 'Other and unspecified cirrhosis of liver',               'Digestive'],
  ['K80.2', 'Calculus of gallbladder without cholecystitis',           'Digestive'],
  ['K81.0', 'Acute cholecystitis',                                     'Digestive'],
  ['K85.9', 'Acute pancreatitis, unspecified',                        'Digestive'],
  ['K86.1', 'Other chronic pancreatitis',                              'Digestive'],
  ['K92.1', 'Melaena',                                                 'Digestive'],

  // ── SKIN ─────────────────────────────────────────────────────────────────
  ['L01.0', 'Impetigo',                                               'Skin'],
  ['L02.9', 'Cutaneous abscess, furuncle and carbuncle, unspecified', 'Skin'],
  ['L03.9', 'Cellulitis, unspecified',                                'Skin'],
  ['L20.9', 'Atopic dermatitis, unspecified (eczema)',               'Skin'],
  ['L23.9', 'Allergic contact dermatitis, unspecified cause',        'Skin'],
  ['L30.9', 'Dermatitis, unspecified',                               'Skin'],
  ['L40.0', 'Psoriasis vulgaris',                                    'Skin'],
  ['L50.0', 'Allergic urticaria (hives)',                            'Skin'],
  ['L70.0', 'Acne vulgaris',                                         'Skin'],
  ['L72.0', 'Epidermal cyst',                                        'Skin'],
  ['L74.0', 'Miliaria rubra (prickly heat)',                         'Skin'],

  // ── MUSCULOSKELETAL ───────────────────────────────────────────────────────
  ['M06.9', 'Rheumatoid arthritis, unspecified',                     'Musculoskeletal'],
  ['M10.0', 'Idiopathic gout',                                       'Musculoskeletal'],
  ['M13.9', 'Arthritis, unspecified',                                'Musculoskeletal'],
  ['M16.1', 'Other primary coxarthrosis (hip osteoarthritis)',       'Musculoskeletal'],
  ['M17.1', 'Other primary gonarthrosis (knee osteoarthritis)',      'Musculoskeletal'],
  ['M19.9', 'Arthrosis, unspecified',                                'Musculoskeletal'],
  ['M24.5', 'Contracture of joint',                                  'Musculoskeletal'],
  ['M32.9', 'Systemic lupus erythematosus, unspecified',            'Musculoskeletal'],
  ['M47.9', 'Spondylosis, unspecified',                             'Musculoskeletal'],
  ['M48.0', 'Spinal stenosis',                                      'Musculoskeletal'],
  ['M50.0', 'Cervical disc disorder with myelopathy',               'Musculoskeletal'],
  ['M51.1', 'Lumbar and other intervertebral disc degeneration',    'Musculoskeletal'],
  ['M54.2', 'Cervicalgia (neck pain)',                               'Musculoskeletal'],
  ['M54.4', 'Lumbago with sciatica',                                'Musculoskeletal'],
  ['M54.5', 'Low back pain',                                        'Musculoskeletal'],
  ['M72.0', 'Palmar fascial fibromatosis (Dupuytren)',              'Musculoskeletal'],
  ['M75.1', 'Rotator cuff syndrome',                                'Musculoskeletal'],
  ['M79.3', 'Panniculitis',                                         'Musculoskeletal'],
  ['M80.9', 'Osteoporosis, unspecified, with pathological fracture','Musculoskeletal'],
  ['M81.0', 'Postmenopausal osteoporosis',                          'Musculoskeletal'],

  // ── GENITOURINARY ─────────────────────────────────────────────────────────
  ['N00.9', 'Acute nephritic syndrome, unspecified',                'Genitourinary'],
  ['N03.9', 'Chronic nephritic syndrome, unspecified',              'Genitourinary'],
  ['N04.9', 'Nephrotic syndrome, unspecified',                      'Genitourinary'],
  ['N10',   'Acute pyelonephritis',                                 'Genitourinary'],
  ['N11.9', 'Chronic tubulo-interstitial nephritis, unspecified',  'Genitourinary'],
  ['N17.9', 'Acute renal failure, unspecified',                     'Genitourinary'],
  ['N18.9', 'Chronic renal failure (CKD), unspecified',            'Genitourinary'],
  ['N20.0', 'Calculus of kidney (kidney stone)',                    'Genitourinary'],
  ['N30.0', 'Acute cystitis',                                       'Genitourinary'],
  ['N30.9', 'Cystitis, unspecified (UTI)',                          'Genitourinary'],
  ['N34.1', 'Nonspecific urethritis',                               'Genitourinary'],
  ['N39.0', 'Urinary tract infection, site not specified (UTI)',    'Genitourinary'],
  ['N40',   'Hyperplasia of prostate (BPH)',                        'Genitourinary'],
  ['N41.1', 'Chronic prostatitis',                                  'Genitourinary'],
  ['N43.3', 'Hydrocele, unspecified',                               'Genitourinary'],
  ['N45.9', 'Orchitis, epididymitis, unspecified',                  'Genitourinary'],
  ['N48.6', 'Balanitis',                                            'Genitourinary'],
  ['N50.9', 'Disorder of male genital organs, unspecified',        'Genitourinary'],
  ['N63',   'Unspecified lump in breast',                           'Genitourinary'],
  ['N70.0', 'Acute salpingitis and oophoritis (PID)',               'Genitourinary'],
  ['N70.1', 'Chronic salpingitis and oophoritis',                  'Genitourinary'],
  ['N71.1', 'Chronic inflammatory disease of uterus',              'Genitourinary'],
  ['N73.9', 'Female pelvic inflammatory disease, unspecified',     'Genitourinary'],
  ['N76.0', 'Acute vaginitis',                                      'Genitourinary'],
  ['N80.0', 'Endometriosis of uterus',                              'Genitourinary'],
  ['N80.9', 'Endometriosis, unspecified',                           'Genitourinary'],
  ['N83.2', 'Other and unspecified ovarian cysts',                 'Genitourinary'],
  ['N92.0', 'Excessive and frequent menstruation (menorrhagia)',   'Genitourinary'],
  ['N94.6', 'Dysmenorrhoea, unspecified (period pain)',             'Genitourinary'],
  ['N95.1', 'Menopausal and female climacteric states',            'Genitourinary'],
  ['N97.9', 'Female infertility, unspecified',                      'Genitourinary'],

  // ── PREGNANCY & MATERNITY ─────────────────────────────────────────────────
  ['O00.0', 'Abdominal ectopic pregnancy',                         'Obstetric'],
  ['O00.1', 'Tubal ectopic pregnancy',                             'Obstetric'],
  ['O02.1', 'Missed abortion',                                     'Obstetric'],
  ['O03.9', 'Spontaneous abortion, complete or unspecified',       'Obstetric'],
  ['O09.9', 'Pregnancy, unspecified duration',                     'Obstetric'],
  ['O10.0', 'Pre-existing essential hypertension complicating pregnancy', 'Obstetric'],
  ['O13',   'Gestational (pregnancy-induced) hypertension',        'Obstetric'],
  ['O14.1', 'Severe pre-eclampsia',                               'Obstetric'],
  ['O14.9', 'Pre-eclampsia, unspecified',                         'Obstetric'],
  ['O15.0', 'Eclampsia in pregnancy',                             'Obstetric'],
  ['O20.0', 'Threatened abortion',                                'Obstetric'],
  ['O20.9', 'Haemorrhage in early pregnancy, unspecified',        'Obstetric'],
  ['O21.0', 'Mild hyperemesis gravidarum',                        'Obstetric'],
  ['O24.4', 'Diabetes mellitus arising in pregnancy (GDM)',       'Obstetric'],
  ['O26.3', 'Retained intrauterine contraceptive device in pregnancy','Obstetric'],
  ['O30.0', 'Twin pregnancy',                                     'Obstetric'],
  ['O32.1', 'Maternal care for breech presentation',              'Obstetric'],
  ['O36.4', 'Maternal care for intrauterine death',               'Obstetric'],
  ['O41.0', 'Oligohydramnios',                                    'Obstetric'],
  ['O41.1', 'Polyhydramnios',                                     'Obstetric'],
  ['O42.0', 'Premature rupture of membranes',                     'Obstetric'],
  ['O60.1', 'Preterm labour with preterm delivery',               'Obstetric'],
  ['O63.9', 'Prolonged labour, unspecified',                      'Obstetric'],
  ['O69.9', 'Labour and delivery complicated by cord complication','Obstetric'],
  ['O72.0', 'Third-stage haemorrhage (PPH)',                      'Obstetric'],
  ['O80',   'Encounter for full-term uncomplicated delivery',      'Obstetric'],
  ['O82',   'Encounter for caesarean delivery',                   'Obstetric'],
  ['O85',   'Puerperal sepsis',                                   'Obstetric'],
  ['O90.3', 'Peripartum cardiomyopathy',                          'Obstetric'],
  ['O98.0', 'Tuberculosis complicating pregnancy',                'Obstetric'],
  ['O98.6', 'Protozoal diseases complicating pregnancy (malaria in pregnancy)', 'Obstetric'],

  // ── PERINATAL ─────────────────────────────────────────────────────────────
  ['P05.9', 'Slow fetal growth, unspecified',                     'Perinatal'],
  ['P07.3', 'Other preterm infants (28-36 weeks)',                'Perinatal'],
  ['P21.0', 'Severe birth asphyxia',                             'Perinatal'],
  ['P22.0', 'Respiratory distress syndrome of newborn (NRDS)',   'Perinatal'],
  ['P36.9', 'Bacterial sepsis of newborn, unspecified',          'Perinatal'],
  ['P52.3', 'Intraventricular haemorrhage (newborn)',            'Perinatal'],
  ['P55.0', 'Rh isoimmunisation of newborn',                    'Perinatal'],
  ['P59.9', 'Neonatal jaundice, unspecified',                    'Perinatal'],

  // ── CONGENITAL ────────────────────────────────────────────────────────────
  ['Q21.0', 'Ventricular septal defect (VSD)',                   'Congenital'],
  ['Q21.1', 'Atrial septal defect (ASD)',                        'Congenital'],
  ['Q35.9', 'Cleft palate, unspecified',                        'Congenital'],
  ['Q65.2', 'Congenital dislocation of hip, unspecified',       'Congenital'],
  ['Q90.9', 'Down syndrome, unspecified',                        'Congenital'],

  // ── SYMPTOMS & SIGNS ──────────────────────────────────────────────────────
  ['R00.0', 'Tachycardia, unspecified',                         'Symptoms'],
  ['R00.1', 'Bradycardia, unspecified',                         'Symptoms'],
  ['R05',   'Cough',                                            'Symptoms'],
  ['R06.0', 'Dyspnoea (breathlessness)',                        'Symptoms'],
  ['R07.4', 'Chest pain, unspecified',                          'Symptoms'],
  ['R10.0', 'Acute abdomen',                                    'Symptoms'],
  ['R10.4', 'Other and unspecified abdominal pain',             'Symptoms'],
  ['R11',   'Nausea and vomiting',                              'Symptoms'],
  ['R17',   'Unspecified jaundice',                             'Symptoms'],
  ['R19.7', 'Diarrhoea, unspecified',                           'Symptoms'],
  ['R20.0', 'Anaesthesia of skin (numbness)',                   'Symptoms'],
  ['R21',   'Rash and other nonspecific skin eruption',         'Symptoms'],
  ['R25.2', 'Cramp and spasm',                                  'Symptoms'],
  ['R29.6', 'Tendency to fall, not elsewhere classified',       'Symptoms'],
  ['R30.0', 'Dysuria (pain on urination)',                      'Symptoms'],
  ['R31',   'Unspecified haematuria',                           'Symptoms'],
  ['R42',   'Dizziness and giddiness',                          'Symptoms'],
  ['R50.9', 'Fever, unspecified (pyrexia)',                     'Symptoms'],
  ['R51',   'Headache',                                         'Symptoms'],
  ['R53.1', 'Weakness',                                         'Symptoms'],
  ['R55',   'Syncope and collapse (fainting)',                  'Symptoms'],
  ['R56.9', 'Convulsions, unspecified',                         'Symptoms'],
  ['R60.9', 'Oedema, unspecified',                              'Symptoms'],
  ['R63.0', 'Anorexia (poor appetite)',                        'Symptoms'],
  ['R63.4', 'Abnormal weight loss',                             'Symptoms'],
  ['R65.9', 'Systemic inflammatory response syndrome (SIRS)',  'Symptoms'],
  ['R73.0', 'Abnormal glucose (pre-diabetes)',                  'Symptoms'],

  // ── INJURIES & TRAUMA ─────────────────────────────────────────────────────
  ['S00.9', 'Superficial injury of head, unspecified',         'Injury'],
  ['S01.0', 'Open wound of scalp',                             'Injury'],
  ['S06.9', 'Intracranial injury, unspecified',                'Injury'],
  ['S09.9', 'Unspecified injury of head',                      'Injury'],
  ['S20.9', 'Superficial injury of thorax, unspecified',       'Injury'],
  ['S30.9', 'Superficial injury of abdomen, part unspecified', 'Injury'],
  ['S40.9', 'Superficial injury of shoulder, unspecified',     'Injury'],
  ['S52.9', 'Fracture of forearm, part unspecified',           'Injury'],
  ['S60.9', 'Superficial injury of wrist and hand',            'Injury'],
  ['S61.9', 'Open wound of wrist and hand, unspecified',       'Injury'],
  ['S62.9', 'Fracture of wrist and hand, unspecified',         'Injury'],
  ['S72.0', 'Fracture of neck of femur (hip fracture)',        'Injury'],
  ['S80.9', 'Superficial injury of lower leg, unspecified',    'Injury'],
  ['S82.9', 'Fracture of lower leg, unspecified',              'Injury'],
  ['S90.9', 'Superficial injury of ankle and foot, unspecified','Injury'],
  ['T14.0', 'Superficial injury of unspecified body region',   'Injury'],
  ['T14.1', 'Open wound of unspecified body region',           'Injury'],
  ['T78.4', 'Allergy, unspecified',                            'Injury'],
  ['T79.3', 'Post-traumatic wound infection',                  'Injury'],

  // ── EXTERNAL CAUSES (common in Nigeria) ──────────────────────────────────
  ['V89.2', 'Motor vehicle accident, unspecified (RTA)',       'External'],
  ['W19.9', 'Unspecified fall',                               'External'],
  ['W54.0', 'Dog bite',                                       'External'],
  ['X41.9', 'Accidental poisoning by drugs',                  'External'],
  ['X49.9', 'Accidental poisoning by other substances',       'External'],

  // ── HEALTH STATUS & Z-CODES ───────────────────────────────────────────────
  ['Z00.0', 'General adult medical examination (routine check-up)', 'Z-Code'],
  ['Z00.1', 'Routine child health examination',               'Z-Code'],
  ['Z01.0', 'Examination of eyes and vision',                'Z-Code'],
  ['Z03.9', 'Observation for suspected disease, unspecified','Z-Code'],
  ['Z12.4', 'Encounter for screening for malignant neoplasm of cervix', 'Z-Code'],
  ['Z13.1', 'Encounter for screening for diabetes mellitus', 'Z-Code'],
  ['Z34.0', 'Encounter for supervision of normal first pregnancy', 'Z-Code'],
  ['Z34.9', 'Encounter for supervision of normal pregnancy, unspecified', 'Z-Code'],
  ['Z38.0', 'Liveborn infant, born in hospital',             'Z-Code'],
  ['Z39.0', 'Encounter for care and examination immediately after delivery', 'Z-Code'],
  ['Z51.1', 'Encounter for antineoplastic chemotherapy',     'Z-Code'],
  ['Z63.0', 'Problems in relationship with spouse or partner', 'Z-Code'],
  ['Z71.1', 'Person with feared complaint in whom no diagnosis is made', 'Z-Code'],
  ['Z76.0', 'Encounter for issue of repeat prescription',    'Z-Code'],
  ['Z76.9', 'Encounter for health service, unspecified',    'Z-Code'],
];

// Insert all codes
let inserted = 0, skipped = 0;
for (const [code, description, category] of codes) {
  try {
    await query(
      'INSERT OR IGNORE INTO icd10_codes (code, description, category) VALUES (?, ?, ?)',
      [code, description, category]
    );
    inserted++;
  } catch { skipped++; }
}

const r = await query('SELECT COUNT(*) as c FROM icd10_codes');
console.log(`\n🎉 Done! ICD-10 codes: ${r.rows[0]?.c} (inserted:${inserted} skipped:${skipped})`);
console.log('  Categories:', [...new Set(codes.map(c=>c[2]))].join(', '));