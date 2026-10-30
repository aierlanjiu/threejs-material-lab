with open('film/film_stage.html', 'r') as f:
    code = f.read()

old_str = "import { compileBandParts, sampleBandEnsemble, bandRoster } from '../js/audio/band-parts.js';"
new_str = "import { compileBandParts, sampleBandEnsemble, bandRoster } from '../js/audio/band-parts.js';\n    import { defaultBandSettings } from '../js/ui/band-settings.js';"

assert old_str in code
code = code.replace(old_str, new_str)

old_settings = """      bandScene.update(ensembleSample, {
        settings: {
          preset: 'concert',
          stageLook,
          formation: film.formation.to,
          lightMode: 'multi',
          contrast: true,
          effects: 'auto'
        },"""

new_settings = """      bandScene.update(ensembleSample, {
        settings: {
          ...defaultBandSettings(),
          preset: 'concert',
          stageLook,
          formation: film.formation.to,
          lightMode: 'multi',
          contrast: true,
          effects: 'auto',
          overrides: {}
        },"""

assert old_settings in code
code = code.replace(old_settings, new_settings)

with open('film/film_stage.html', 'w') as f:
    f.write(code)
print("Updated film_stage.html settings")
