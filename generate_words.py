# generate_words.py
import json
import os

def create_ts_file():
    input_file = 'uz_raw.txt'
    output_file = 'src/words.ts'

    if not os.path.exists(input_file):
        print(f"Xato: '{input_file}' topilmadi. Uni asosiy papkaga joylang.")
        return

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
            # Vergul bo'yicha ajratamiz
            raw_list = content.split(',')
    except Exception as e:
        print(f"Faylni o'qishda xato: {e}")
        return

    # So'zlarni tozalash (bo'shliqlarni olib tashlash, dublikatlarni o'chirish)
    clean_set = set()
    for word in raw_list:
        stripped = word.strip()
        # 1 harfli so'zlarni (masalan 'u', 'i') o'yin uchun qiyin bo'lgani uchun o'tkazib yuboramiz
        if len(stripped) > 1:
            # O'zbek tilidagi o' va g' harflarini to'g'ri saqlab qolgan holda birinchi harfni katta qilamiz
            clean_set.add(stripped.capitalize())

    # Alifbo bo'yicha saralash
    unique_words = sorted(list(clean_set))

    word_objects = []
    for i, word in enumerate(unique_words):
        # Uzunligiga qarab qiyinchilik darajasi
        length = len(word)
        if length <= 5:
            diff = "easy"
        elif length <= 9:
            diff = "medium"
        else:
            diff = "hard"
            
        word_objects.append({
            "id": i + 1,
            "text": word,
            "difficulty": diff
        })

    # TypeScript fayl tarkibi
    ts_content = "import { Word } from './types';\n\n"
    ts_content += "export const wordBank: Record<string, Word[]> = {\n"
    ts_content += "  uz: " + json.dumps(word_objects, ensure_ascii=False, indent=2) + ",\n"
    ts_content += "  en: [\n    { id: 10000, text: 'Apple', difficulty: 'easy' },\n    { id: 10001, text: 'Success', difficulty: 'medium' }\n  ]\n};"

    try:
        if not os.path.exists('src'):
            os.makedirs('src')
            
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(ts_content)
        
        print(f"--- MUVAFFAQIYAT ---")
        print(f"{len(word_objects)} ta takrorlanmas o'zbekcha so'z yuklandi.")
        print(f"Fayl yangilandi: {output_file}")
    except Exception as e:
        print(f"Faylga yozishda xato: {e}")

if __name__ == "__main__":
    create_ts_file()