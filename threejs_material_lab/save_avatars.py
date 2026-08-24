import os

os.makedirs('assets/avatars', exist_ok=True)

svg_templates = {
    'cloud': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="24" y="24" width="464" height="464" rx="130" fill="#70b5ff"/>
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#1e40af" flood-opacity="0.22"/>
    </filter>
  </defs>
  <path d="M100 488 L412 488 C412 488 470 488 470 410 C470 340 410 330 395 330 C395 240 310 215 250 255 C210 180 120 200 95 285 C40 290 35 375 60 425 C75 465 100 488 100 488 Z" fill="#ffffff" filter="url(#shadow)"/>
  <rect x="265" y="295" width="34" height="68" rx="17" fill="#050608"/>
  <rect x="330" y="295" width="34" height="68" rx="17" fill="#050608"/>
</svg>''',

    'rabbit': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="24" y="24" width="464" height="464" rx="130" fill="#fbc89b"/>
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#9a3412" flood-opacity="0.18"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <ellipse cx="185" cy="200" rx="40" ry="115" transform="rotate(-12 185 200)" fill="#ffffff"/>
    <ellipse cx="325" cy="205" rx="40" ry="115" transform="rotate(12 325 205)" fill="#ffffff"/>
    <ellipse cx="270" cy="420" rx="180" ry="175" fill="#ffffff"/>
  </g>
  <rect x="210" y="335" width="32" height="64" rx="16" transform="rotate(-8 226 367)" fill="#1e293b"/>
  <rect x="295" y="340" width="32" height="64" rx="16" transform="rotate(8 311 372)" fill="#1e293b"/>
</svg>''',

    'sun': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="24" y="24" width="464" height="464" rx="130" fill="#948999"/>
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#2e1065" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#shadow)" fill="#f3ba8a">
    <rect x="234" y="90" width="44" height="44" rx="12" transform="rotate(45 256 112)"/>
    <rect x="374" y="170" width="44" height="44" rx="12" transform="rotate(45 396 192)"/>
    <rect x="374" y="310" width="44" height="44" rx="12" transform="rotate(45 396 332)"/>
    <rect x="234" y="390" width="44" height="44" rx="12" transform="rotate(45 256 412)"/>
    <rect x="94" y="310" width="44" height="44" rx="12" transform="rotate(45 116 332)"/>
    <rect x="94" y="170" width="44" height="44" rx="12" transform="rotate(45 116 192)"/>
    <circle cx="256" cy="262" r="140"/>
  </g>
  <rect x="200" y="230" width="30" height="58" rx="15" fill="#33272b"/>
  <rect x="282" y="230" width="30" height="58" rx="15" fill="#33272b"/>
  <path d="M226 304 Q256 336 286 304" stroke="#33272b" stroke-width="10" stroke-linecap="round" fill="none"/>
</svg>''',

    'bear': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="24" y="24" width="464" height="464" rx="130" fill="#feeebe"/>
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#854d0e" flood-opacity="0.15"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <circle cx="145" cy="195" r="58" fill="#eed6b8"/>
    <circle cx="145" cy="195" r="32" fill="#dbb58f"/>
    <circle cx="367" cy="195" r="58" fill="#eed6b8"/>
    <circle cx="367" cy="195" r="32" fill="#dbb58f"/>
    <circle cx="256" cy="350" r="165" fill="#eed6b8"/>
  </g>
  <rect x="200" y="325" width="28" height="52" rx="14" fill="#2b1d18"/>
  <rect x="284" y="325" width="28" height="52" rx="14" fill="#2b1d18"/>
  <circle cx="256" cy="375" r="14" fill="#2b1d18"/>
</svg>''',

    'dog': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="24" y="24" width="464" height="464" rx="130" fill="#c7d2fe"/>
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#3730a3" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <ellipse cx="130" cy="265" rx="40" ry="88" transform="rotate(18 130 265)" fill="#64748b"/>
    <ellipse cx="382" cy="265" rx="40" ry="88" transform="rotate(-18 382 265)" fill="#64748b"/>
    <circle cx="256" cy="360" r="160" fill="#ffffff"/>
  </g>
  <rect x="204" y="335" width="28" height="52" rx="14" fill="#1e293b"/>
  <rect x="280" y="335" width="28" height="52" rx="14" fill="#1e293b"/>
  <polygon points="242,395 270,395 256,412" fill="#1e293b"/>
</svg>''',

    'agent': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="24" y="24" width="464" height="464" rx="130" fill="#38bdf8"/>
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0369a1" flood-opacity="0.3"/>
    </filter>
  </defs>
  <circle cx="256" cy="262" r="155" fill="#2563eb" filter="url(#shadow)"/>
  <rect x="198" y="225" width="32" height="64" rx="16" fill="#ffffff"/>
  <rect x="282" y="225" width="32" height="64" rx="16" fill="#ffffff"/>
  <path d="M218 308 Q256 348 294 308" stroke="#ffffff" stroke-width="10" stroke-linecap="round" fill="none"/>
</svg>''',

    'cat': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="24" y="24" width="464" height="464" rx="130" fill="#fbcfe8"/>
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#9d174d" flood-opacity="0.18"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <polygon points="120,240 160,135 230,210" fill="#ffffff"/>
    <polygon points="140,225 168,155 212,205" fill="#f472b6"/>
    <polygon points="392,240 352,135 282,210" fill="#ffffff"/>
    <polygon points="372,225 344,155 300,205" fill="#f472b6"/>
    <circle cx="256" cy="345" r="158" fill="#ffffff"/>
  </g>
  <rect x="200" y="325" width="30" height="56" rx="15" fill="#050608"/>
  <rect x="282" y="325" width="30" height="56" rx="15" fill="#050608"/>
  <path d="M236 385 Q246 398 256 385 Q266 398 276 385" stroke="#050608" stroke-width="8" stroke-linecap="round" fill="none"/>
</svg>''',

    'bun': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="24" y="24" width="464" height="464" rx="130" fill="#fecdd3"/>
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#be123c" flood-opacity="0.2"/>
    </filter>
  </defs>
  <ellipse cx="256" cy="310" rx="170" ry="140" fill="#fff1f2" filter="url(#shadow)"/>
  <circle cx="205" cy="290" r="30" fill="#1e293b"/>
  <circle cx="196" cy="280" r="14" fill="#ffffff"/>
  <circle cx="218" cy="300" r="7" fill="#ffffff"/>
  <circle cx="307" cy="290" r="30" fill="#1e293b"/>
  <circle cx="298" cy="280" r="14" fill="#ffffff"/>
  <circle cx="320" cy="300" r="7" fill="#ffffff"/>
  <ellipse cx="160" cy="325" rx="24" ry="14" fill="#fb7185" opacity="0.55"/>
  <ellipse cx="352" cy="325" rx="24" ry="14" fill="#fb7185" opacity="0.55"/>
</svg>'''
}

for name, content in svg_templates.items():
    filepath = os.path.join('assets', 'avatars', f'{name}.svg')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Successfully saved {filepath}')
