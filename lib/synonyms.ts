/**
 * Category synonyms, so a search matches what people actually type.
 *
 * The alphabet layer in lib/alphabet.ts solves *scripts*: "чойхона" and
 * "çoyxona" fold to one key. It does nothing for different *words* — a
 * Russian speaker searching "аптека" is not misspelling "dorixona", they
 * are using another language, and Tashkent runs on both.
 *
 * These are expanded at index time rather than query time: one pass at
 * build, nothing extra shipped to the browser, and MiniSearch's fuzzy
 * matching applies to them like any other term.
 *
 * Terms are written naturally and normalised by toSearchKey, so Cyrillic
 * entries here need no transliteration by hand.
 */
export const SYNONYMS: Record<string, string[]> = {
  // Ovqatlanish
  'ovqatlanish/restoran': ['ресторан', 'restaurant', 'ovqat', 'taom'],
  'ovqatlanish/kafe': ['кафе', 'cafe', 'coffee'],
  'ovqatlanish/choyxona': ['чайхана', 'чайхона', 'teahouse', 'osh', 'oshxona', 'плов', 'palov'],
  'ovqatlanish/fast-food': ['фастфуд', 'fast food', 'бургер', 'burger', 'lavash', 'лаваш'],
  'ovqatlanish/qahvaxona': ['кофейня', 'кофе', 'coffee', 'qahva', 'espresso'],

  // Gözallik
  'gozallik/sartaroshxona': ['парикмахерская', 'барбершоп', 'barbershop', 'barber', 'sartaroş', 'soç'],
  'gozallik/salon': ['салон красоты', 'красота', 'beauty salon', 'beauty', 'gözallik'],
  'gozallik/manikyur': ['маникюр', 'педикюр', 'manicure', 'pedicure', 'nail', 'tirnoq'],
  'gozallik/spa': ['спа', 'spa', 'массаж', 'massaj', 'hammom'],

  // Soğliq
  'sogliq/klinika': ['клиника', 'больница', 'clinic', 'hospital', 'şifoxona', 'doktor', 'врач', 'shifokor'],
  'sogliq/stomatologiya': ['стоматология', 'зубной', 'dentist', 'dental', 'tiş', 'tiş şifokori'],
  'sogliq/dorixona': ['аптека', 'pharmacy', 'drugstore', 'dori', 'лекарство'],
  'sogliq/laboratoriya': ['лаборатория', 'laboratory', 'анализ', 'analiz', 'tahlil'],

  // Taʼlim
  'talim/universitet': ['университет', 'university', 'oliy taʼlim', 'вуз', 'institut', 'институт'],
  'talim/oquv-markaz': ['учебный центр', 'курсы', 'kurs', 'training', 'course', 'oʻquv kurs'],
  'talim/til-markazi': ['языковой центр', 'английский', 'ingliz tili', 'language', 'ielts'],
  'talim/maktab': ['школа', 'school', 'maktab', 'litsey', 'лицей'],

  // Savdo
  'savdo/bozor': ['базар', 'рынок', 'bazar', 'market', 'bozor'],
  'savdo/kompyuter': ['компьютер', 'computer', 'noutbuk', 'ноутбук', 'laptop', 'pc'],
  'savdo/savdo-markazi': ['торговый центр', 'mall', 'savdo markaz', 'тц'],
  'savdo/texnika': ['бытовая техника', 'техника', 'electronics', 'maişiy texnika'],
}

/** Every alternative term for a "top/sub" category path. */
export function synonymsFor(category: string): string[] {
  return SYNONYMS[category] ?? []
}
