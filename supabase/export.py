import json
import os

# SQL çıktısını içeren JSON dosyasını oku
input_file = "supabase_schema_output.json"  # SQL çıktısının kaydedildiği dosya
output_dir = "output"  # JSON dosyalarının kaydedileceği dizin

# Çıktı dizinini oluştur
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# JSON dosyasını oku
with open(input_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Her tablo için ayrı bir JSON dosyası oluştur
for table in data:
    schema = table['table_schema']
    table_name = table['table_name']
    
    # Dosya adı: schema_name.table_name.json
    file_name = f"{schema}.{table_name}.json"
    file_path = os.path.join(output_dir, file_name)
    
    # Tablo verilerini JSON dosyasına yaz
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(table, f, indent=2, ensure_ascii=False)
    
    print(f"Created: {file_path}")

print("Export completed!")