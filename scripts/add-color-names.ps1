# Script para agregar nombres de colores a todos los archivos de idioma

$colorTranslations = @{
    "en" = @{
        "Azul" = "Blue"
        "Rojo" = "Red"
        "Verde" = "Green"
        "Púrpura" = "Purple"
        "Naranja" = "Orange"
        "Rojo Vibrante" = "Vibrant Red"
        "Naranja Intenso" = "Intense Orange"
        "Ámbar" = "Amber"
        "Lima" = "Lime"
        "Esmeralda" = "Emerald"
        "Cian" = "Cyan"
        "Azul Rey" = "Royal Blue"
        "Violeta" = "Violet"
        "Rosa Fucsia" = "Fuchsia Pink"
        "Rosa Intenso" = "Intense Pink"
        "Rosa Pastel" = "Pastel Pink"
        "Melocotón" = "Peach"
        "Amarillo Suave" = "Soft Yellow"
        "Lima Pastel" = "Pastel Lime"
        "Verde Menta" = "Mint Green"
        "Celeste" = "Sky Blue"
        "Azul Cielo" = "Light Blue"
        "Lavanda" = "Lavender"
        "Rosa Claro" = "Light Pink"
        "Coral Suave" = "Soft Coral"
        "Pizarra" = "Slate"
        "Azul Marino" = "Navy Blue"
        "Rosa Oscuro" = "Dark Pink"
        "Púrpura Oscuro" = "Dark Purple"
        "Marrón" = "Brown"
        "Verde Oscuro" = "Dark Green"
        "Verde Azulado" = "Teal"
        "Azul Profundo" = "Deep Blue"
        "Índigo Oscuro" = "Dark Indigo"
        "Carmesí" = "Crimson"
    }
    "pt" = @{
        "Azul" = "Azul"
        "Rojo" = "Vermelho"
        "Verde" = "Verde"
        "Púrpura" = "Púrpura"
        "Naranja" = "Laranja"
        "Rojo Vibrante" = "Vermelho Vibrante"
        "Naranja Intenso" = "Laranja Intenso"
        "Ámbar" = "Âmbar"
        "Lima" = "Lima"
        "Esmeralda" = "Esmeralda"
        "Cian" = "Ciano"
        "Azul Rey" = "Azul Real"
        "Violeta" = "Violeta"
        "Rosa Fucsia" = "Rosa Fúcsia"
        "Rosa Intenso" = "Rosa Intenso"
        "Rosa Pastel" = "Rosa Pastel"
        "Melocotón" = "Pêssego"
        "Amarillo Suave" = "Amarelo Suave"
        "Lima Pastel" = "Lima Pastel"
        "Verde Menta" = "Verde Menta"
        "Celeste" = "Celeste"
        "Azul Cielo" = "Azul Céu"
        "Lavanda" = "Lavanda"
        "Rosa Claro" = "Rosa Claro"
        "Coral Suave" = "Coral Suave"
        "Pizarra" = "Ardósia"
        "Azul Marino" = "Azul Marinho"
        "Rosa Oscuro" = "Rosa Escuro"
        "Púrpura Oscuro" = "Púrpura Escuro"
        "Marrón" = "Marrom"
        "Verde Oscuro" = "Verde Escuro"
        "Verde Azulado" = "Verde Azulado"
        "Azul Profundo" = "Azul Profundo"
        "Índigo Oscuro" = "Índigo Escuro"
        "Carmesí" = "Carmesim"
    }
    "fr" = @{
        "Azul" = "Bleu"
        "Rojo" = "Rouge"
        "Verde" = "Vert"
        "Púrpura" = "Violet"
        "Naranja" = "Orange"
        "Rojo Vibrante" = "Rouge Vibrant"
        "Naranja Intenso" = "Orange Intense"
        "Ámbar" = "Ambre"
        "Lima" = "Citron"
        "Esmeralda" = "Émeraude"
        "Cian" = "Cyan"
        "Azul Rey" = "Bleu Royal"
        "Violeta" = "Violet"
        "Rosa Fucsia" = "Rose Fuchsia"
        "Rosa Intenso" = "Rose Intense"
        "Rosa Pastel" = "Rose Pastel"
        "Melocotón" = "Pêche"
        "Amarillo Suave" = "Jaune Doux"
        "Lima Pastel" = "Citron Pastel"
        "Verde Menta" = "Vert Menthe"
        "Celeste" = "Céleste"
        "Azul Cielo" = "Bleu Ciel"
        "Lavanda" = "Lavande"
        "Rosa Claro" = "Rose Clair"
        "Coral Suave" = "Corail Doux"
        "Pizarra" = "Ardoise"
        "Azul Marino" = "Bleu Marine"
        "Rosa Oscuro" = "Rose Foncé"
        "Púrpura Oscuro" = "Violet Foncé"
        "Marrón" = "Marron"
        "Verde Oscuro" = "Vert Foncé"
        "Verde Azulado" = "Bleu-Vert"
        "Azul Profundo" = "Bleu Profond"
        "Índigo Oscuro" = "Indigo Foncé"
        "Carmesí" = "Cramoisi"
    }
    "de" = @{
        "Azul" = "Blau"
        "Rojo" = "Rot"
        "Verde" = "Grün"
        "Púrpura" = "Lila"
        "Naranja" = "Orange"
        "Rojo Vibrante" = "Leuchtendes Rot"
        "Naranja Intenso" = "Intensives Orange"
        "Ámbar" = "Bernstein"
        "Lima" = "Limette"
        "Esmeralda" = "Smaragd"
        "Cian" = "Cyan"
        "Azul Rey" = "Königsblau"
        "Violeta" = "Violett"
        "Rosa Fucsia" = "Fuchsia Rosa"
        "Rosa Intenso" = "Intensives Rosa"
        "Rosa Pastel" = "Pastellrosa"
        "Melocotón" = "Pfirsich"
        "Amarillo Suave" = "Sanftes Gelb"
        "Lima Pastel" = "Pastell-Limette"
        "Verde Menta" = "Minzgrün"
        "Celeste" = "Himmelblau"
        "Azul Cielo" = "Hellblau"
        "Lavanda" = "Lavendel"
        "Rosa Claro" = "Hellrosa"
        "Coral Suave" = "Sanftes Koralle"
        "Pizarra" = "Schiefer"
        "Azul Marino" = "Marineblau"
        "Rosa Oscuro" = "Dunkelrosa"
        "Púrpura Oscuro" = "Dunkellila"
        "Marrón" = "Braun"
        "Verde Oscuro" = "Dunkelgrün"
        "Verde Azulado" = "Blaugrün"
        "Azul Profundo" = "Tiefblau"
        "Índigo Oscuro" = "Dunkelindigo"
        "Carmesí" = "Karmesin"
    }
    "it" = @{
        "Azul" = "Blu"
        "Rojo" = "Rosso"
        "Verde" = "Verde"
        "Púrpura" = "Viola"
        "Naranja" = "Arancione"
        "Rojo Vibrante" = "Rosso Vibrante"
        "Naranja Intenso" = "Arancione Intenso"
        "Ámbar" = "Ambra"
        "Lima" = "Lime"
        "Esmeralda" = "Smeraldo"
        "Cian" = "Ciano"
        "Azul Rey" = "Blu Reale"
        "Violeta" = "Violetto"
        "Rosa Fucsia" = "Rosa Fucsia"
        "Rosa Intenso" = "Rosa Intenso"
        "Rosa Pastel" = "Rosa Pastello"
        "Melocotón" = "Pesca"
        "Amarillo Suave" = "Giallo Tenue"
        "Lima Pastel" = "Lime Pastello"
        "Verde Menta" = "Verde Menta"
        "Celeste" = "Celeste"
        "Azul Cielo" = "Azzurro"
        "Lavanda" = "Lavanda"
        "Rosa Claro" = "Rosa Chiaro"
        "Coral Suave" = "Corallo Tenue"
        "Pizarra" = "Ardesia"
        "Azul Marino" = "Blu Marina"
        "Rosa Oscuro" = "Rosa Scuro"
        "Púrpura Oscuro" = "Viola Scuro"
        "Marrón" = "Marrone"
        "Verde Oscuro" = "Verde Scuro"
        "Verde Azulado" = "Verde Acqua"
        "Azul Profundo" = "Blu Profondo"
        "Índigo Oscuro" = "Indaco Scuro"
        "Carmesí" = "Cremisi"
    }
}

Write-Host "Agregando nombres de colores a archivos de idioma..." -ForegroundColor Green

# Procesar idiomas con traducciones completas
foreach ($lang in $colorTranslations.Keys) {
    $filePath = "F:\Descargas\Git\Proyecto-Hospital-Padre-Hurtado\incodefy\locales\$lang.json"
    
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        
        # Buscar la posición después de "categories": { ... }
        # Agregar "color_names" después de "categories"
        $colorNamesJson = @"
,
      "color_names": {

"@
        
        foreach ($key in $colorTranslations[$lang].Keys) {
            $value = $colorTranslations[$lang][$key]
            $colorNamesJson += @"
        "$key": "$value",

"@
        }
        
        # Remover la última coma
        $colorNamesJson = $colorNamesJson.TrimEnd(",`r`n") + "`r`n      }"
        
        # Reemplazar en el archivo
        $content = $content -replace '("dark": "[^"]+"\s*}\s*)', "`$1$colorNamesJson"
        
        Set-Content $filePath $content -Encoding UTF8 -NoNewline
        Write-Host "✓ Actualizado: $lang.json" -ForegroundColor Cyan
    }
}

Write-Host "`nProceso completado!" -ForegroundColor Green
