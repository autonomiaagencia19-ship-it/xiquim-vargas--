import fs from 'node:fs';
import path from 'node:path';

// Expanded brands list
const KNOWN_BRANDS = [
  'Abracadabra', 'Kitana', 'Nucita', 'Paratuaba', 'Paratudo', 'Aperol', 'Arcor', 'Tio Paco',
  'BIC', 'Bacardi', 'Freegells', 'Halls', 'Dori', 'Fruit-tella', 'Ice Kiss', 'Santa Rita',
  'Garoto', 'Beats', 'Ibituruna', 'Bauducco', 'Bel', 'Black Night', 'Brahma', 'Skol',
  'Budweiser', 'Camp', 'Campo Largo', 'Caninha da Roça', 'Cardozano', 'Catuaba Selvagem',
  'Chanceler', 'Chivas', 'Ciroc', 'Coca-Cola', 'Fanta', 'Sprite', 'Corote', 'Corona',
  'Cowboy', 'Del Valle', 'DipLoko', 'Do Leste', 'Doces da Rainha', 'Doces Ouro de Minas',
  'Doces Poeta', 'Docile', 'Drinkball', 'Dum Dum', 'Encopa', 'Red Bull', 'Fini',
  'Frutos da Terra', 'Gatorade', 'Heineken', 'Hits Power', 'Jack Daniel', 'Johnnie Walker',
  'Jose Cuervo', 'Jundiaí', 'Jurupinga', 'Kit Kat', 'Leko', 'Lindoya', 'Mansão Maromba',
  'Martini', 'Mentos', 'Mindy', 'Monster', 'Montilla', 'Nautique', 'Nestlé', 'Nutella',
  'Old Eight', 'Olé', 'Orloff', 'Paranight', 'Paratini', 'Pará do Norte', 'Passport',
  'Pink Moon', 'Piracanjuba', 'Raykoff', 'Rayovac', 'Red Hot', 'Renata', 'Renovo',
  'Resende', 'Rexona', 'Ricco', 'Roberta', 'Royal', 'S Cantina', 'Santille', 'Santpel',
  'Simo Kantada', 'Smirnoff', 'Sorriso', 'Sport Click', 'Stempel', 'Stillu\'s', 'Sunakku',
  'Super Click', 'Syn', 'São João da Barra', 'Tanqueray', 'Tem Tudo', 'Terror Zone',
  'Tixan', 'Toddy', 'Torcida', 'Trento', 'Ultra Copos', 'Totalplast', 'Ultratherm',
  'Vimag', 'Vitalidade', 'Vovó Dolores', 'White Horse', 'Wilkinson Sword', 'Wilkinson',
  'Yoki', 'Ypê', 'Zomo', 'Albany', 'Gulão', 'Júnior Click', 'Frisa'
];

// Expanded flavors list
const KNOWN_FLAVORS = [
  'Tangerina', 'Chocolate e Avelãs', 'Chocolate', 'Morango', 'Tutti-Frutti', 'Uva',
  'Mousse de Maracujá', 'Intense Expresso', 'Extra Forte', 'Uva Verde', 'Cola',
  'Azedinho Morango', 'Eucalipto', 'Menta', 'Cereja', 'Melancia', 'Hortelã',
  'Canela', 'Caramelos ao Leite', 'Cebola e Salsa', 'Churrasco', 'Costela no Bafo',
  'Costela', 'Bacon', 'Presunto', 'Queijo', 'Calabresa', 'Pizza', 'Pimenta Mexicana',
  'Limão Siciliano', 'Limão', 'Laranja', 'Maracujá', 'Coco', 'Maçã Verde', 'Tropical',
  'Açaí', 'Pêssego', 'Groselha', 'Blueberry', 'Framboesa', 'Amêndoas', 'Lavanda',
  'Óleo de Macadâmia', 'Doce de Leite', 'Banana', 'Abacaxi'
];

export function extractBrand(name) {
  const n = name.trim();
  for (const b of KNOWN_BRANDS) {
    // Normalization insensitive match
    const bNorm = b.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nNorm = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const regex = new RegExp(`\\b${bNorm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (regex.test(nNorm)) return b;
  }
  return null;
}

export function extractFlavor(name) {
  const n = name.trim();
  for (const f of KNOWN_FLAVORS) {
    const fNorm = f.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nNorm = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const regex = new RegExp(`\\b${fNorm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (regex.test(nNorm)) return f;
  }
  return null;
}

export function extractSize(name) {
  // Look for weight / volume first: e.g. 1L, 900ml, 1,1kg, 500g
  const mWeight = name.match(/([0-9]+(?:[,\.][0-9]+)?\s*(?:ml|l|litros|kg|g)\b)/i);
  if (mWeight) return mWeight[1].trim();

  // Otherwise count units / sheets: e.g. 2000 folhas, 48un, 12 rolos
  const mUnits = name.match(/([0-9]+\s*(?:unidades|un|folhas|rolos|m)\b)/i);
  if (mUnits) return mUnits[1].trim();

  return null;
}

export function extractQuantity(name) {
  const mUnits = name.match(/([0-9]+\s*(?:unidades|un|tubos|rolos|folhas)\b)/i);
  return mUnits ? mUnits[1].trim() : null;
}

export function extractUnit(name) {
  const n = name.toLowerCase();
  if (n.includes('fardo') || n.includes(' fd ')) return 'FD';
  if (n.includes('caixa') || n.includes(' cx ') || n.includes('display')) return 'CX';
  if (n.includes('pacote') || n.includes(' pct ') || n.includes('pack')) return 'PCT';
  return 'UN';
}

export function estimateProductPrice(name, cat, sub) {
  const n = name.toLowerCase();

  // Fardos & Packs de Bebidas
  if (n.includes('fardo 24un') || n.includes('24un')) {
    if (n.includes('syn') || n.includes('ice')) return 149.90;
    return 139.90;
  }
  if (n.includes('fardo 12') || n.includes('12 un')) {
    if (n.includes('pink moon')) return 78.90;
    if (n.includes('cerveja') || n.includes('stempel')) return 54.90;
    if (n.includes('suco leko')) return 32.90;
    if (n.includes('sabonete')) return 28.90;
  }
  if (n.includes('fardo 6') || n.includes('6 un') || n.includes('pack 6')) {
    if (n.includes('sprite') || n.includes('refrigerante')) return 23.90;
    if (n.includes('syn')) return 39.90;
  }
  if (n.includes('fardo')) {
    if (n.includes('água mineral') || n.includes('agua mineral')) return 24.90;
    if (n.includes('red hot 2l')) return 79.90;
    if (n.includes('polvilho') || n.includes('chips') || n.includes('click') || n.includes('gulão') || n.includes('salgadinho')) return 34.90;
    if (n.includes('pink moon')) return 72.90;
    if (n.includes('drinkball')) return 49.90;
  }

  // Caixas e Displays de Doces / Balas
  if (n.includes('display') || n.includes('caixa') || n.includes('pote') || n.includes('cx')) {
    if (n.includes('halls') || n.includes('freegells') || n.includes('fruit-tella')) return 22.90;
    if (n.includes('trento') && n.includes('16un')) return 34.90;
    if (n.includes('baton') || n.includes('nestlé') || n.includes('chokito') || n.includes('prestígio')) return 48.90;
    if (n.includes('blong') && n.includes('24un')) return 36.90;
    if (n.includes('pirulito') && (n.includes('50un') || n.includes('500g'))) return 24.90;
    if (n.includes('nucita') || n.includes('amassaxup')) return 32.90;
    if (n.includes('butter toffees')) return 21.90;
    if (n.includes('dori gomets') || n.includes('dori gota')) return 27.90;
    if (n.includes('santa rita') && (n.includes('500g') || n.includes('600g'))) return 19.90;
    if (n.includes('paçocão') || n.includes('paçoquinha') || n.includes('doce de amendoim') || n.includes('cocada') || n.includes('bananada') || n.includes('palha italiana')) {
      if (n.includes('2kg')) return 44.90;
      if (n.includes('1,6kg') || n.includes('1.6kg')) return 38.90;
      if (n.includes('1,1kg') || n.includes('1.1kg') || n.includes('1,05kg') || n.includes('1000g')) return 32.90;
      return 26.90;
    }
    if (n.includes('terror zone') || n.includes('olhos')) return 29.90;
    if (n.includes('diploko')) return 34.90;
    if (n.includes('isqueiro') || n.includes('bic')) return 54.00;
    if (n.includes('pilha') || n.includes('rayovac')) return 58.00;
  }

  // Bebidas Específicas
  if (n.includes('tanqueray')) return 129.90;
  if (n.includes('aperol')) return 64.90;
  if (n.includes('abracadabra gin')) return 32.90;
  if (n.includes('stillu\'s dry gin') || n.includes('stillus')) return 27.90;
  if (n.includes('bacardi mojito')) return 46.90;
  if (n.includes('raykoff')) return 22.90;
  if (n.includes('paratini') || n.includes('paratudo') || n.includes('paratuaba') || n.includes('pará do norte')) return 16.90;
  if (n.includes('s cantina') || n.includes('conhaque') || n.includes('são joão da barra')) return 18.90;
  if (n.includes('bananinha boah')) return 21.90;
  if (n.includes('santille') && n.includes('2l')) return 28.90;
  if (n.includes('pink moon')) return 12.90;
  if (n.includes('red bull')) return 8.90;
  if (n.includes('paranight 2l') || n.includes('red hot 2l')) return 14.90;
  if (n.includes('nutella 650g')) return 44.90;
  if (n.includes('nutella 350g')) return 26.90;
  if (n.includes('toddy 370g')) return 11.90;
  if (n.includes('stempel red') && n.includes('600ml')) return 8.90;
  if (n.includes('stempel red') && n.includes('355ml')) return 5.90;
  if (n.includes('beats')) return 6.90;
  if (n.includes('syn space') || n.includes('syn ice')) return 6.50;

  // Higiene & Limpeza
  if (n.includes('tixan')) return 9.90;
  if (n.includes('ypê detergente') || n.includes('detergente')) return 3.20;
  if (n.includes('sabao em barra') || n.includes('sabão em barra')) return 14.50;
  if (n.includes('agua sanitaria') || n.includes('água sanitária')) return 4.90;
  if (n.includes('rexona')) return 16.90;
  if (n.includes('sorriso') || n.includes('creme dental')) return 15.90;
  if (n.includes('papel hig') && n.includes('12 rolos')) return 22.90;
  if (n.includes('papel hig') && n.includes('4 rolos')) return 8.90;
  if (n.includes('wilkinson') || n.includes('lâminas')) return 32.00;
  if (n.includes('sabonete')) return 28.90;

  // Descartáveis
  if (n.includes('ultra copos') || (n.includes('copos') && n.includes('770ml'))) return 19.90;
  if (n.includes('guardanapo') && n.includes('2000')) return 36.90;
  if (n.includes('saco de papel')) return 14.90;
  if (n.includes('garrafa plástica') || n.includes('garrafa plastica')) return 24.90;
  if (n.includes('prato') || n.includes('totalplast')) return 29.90;

  // Mercearia & Alimentos
  if (n.includes('renata') || n.includes('roberta') || n.includes('caracolino') || n.includes('parafuso')) return 5.90;
  if (n.includes('salsicha frisa')) return 8.90;
  if (n.includes('sardinha') || n.includes('nautique')) return 6.50;
  if (n.includes('azeitona')) return 7.90;
  if (n.includes('shoyu') || n.includes('sunakku')) return 5.90;
  if (n.includes('leite condensado') || n.includes('piracanjuba')) return 7.50;
  if (n.includes('biscoito') || n.includes('cracker')) return 4.50;
  if (n.includes('yoki pipoca')) return 5.50;
  if (n.includes('torcida')) return 4.20;
  if (n.includes('super click 40g') || n.includes('sport click')) return 3.20;
  if (n.includes('torresminho') || n.includes('pururuca')) return 4.90;
  if (n.includes('banana chips')) return 4.90;
  if (n.includes('xarope')) return 29.90;

  // Fallbacks por Categoria
  if (cat === 'Destilados & Aperitivos') return 29.90;
  if (cat === 'Cervejas & Drinks Prontos') return 7.50;
  if (cat === 'Vinhos & Coquetéis') return 24.90;
  if (cat === 'Energéticos') return 12.50;
  if (cat === 'Refrigerantes') return 8.50;
  if (cat === 'Sucos, Águas & Chás') return 6.90;
  if (cat === 'Doces & Gomas') return 18.90;
  if (cat === 'Petiscos & Mercearia') return 7.90;
  if (cat === 'Descartáveis & Utilidades') return 16.90;

  return 14.90;
}

export function generateProductDescription(name, cat, sub, brand, flavor, size, unit, quantity) {
  const parts = [];
  
  // Title sentence
  if (brand && !name.toLowerCase().startsWith(brand.toLowerCase())) {
    parts.push(`${name} da marca ${brand}.`);
  } else {
    parts.push(`${name}.`);
  }

  // Specifications
  const specs = [];
  if (flavor) specs.push(`sabor ${flavor}`);
  if (size) specs.push(`conteúdo de ${size}`);
  if (quantity && quantity !== size) specs.push(`embalagem com ${quantity}`);
  if (unit === 'FD') specs.push('apresentação em fardo fechado');
  else if (unit === 'CX') specs.push('display/caixa para exibição em balcão');
  else if (unit === 'PCT') specs.push('embalagem econômica em pacote');

  if (specs.length > 0) {
    parts.push(`Produto com ${specs.join(', ')}.`);
  }

  // Category specific commercial context
  if (cat === 'Destilados & Aperitivos' || cat === 'Cervejas & Drinks Prontos' || cat === 'Vinhos & Coquetéis') {
    parts.push('Excelente opção para adegas, bares, restaurantes, conveniências e eventos de alto giro.');
  } else if (cat === 'Doces & Gomas') {
    parts.push('Item de alta saída para bombonieres, mercearias, padarias, cantinas e comércio de guloseimas.');
  } else if (sub === 'Higiene & Limpeza') {
    parts.push('Artigo essencial de limpeza e higienização residencial e corporativa com qualidade e alto rendimento.');
  } else if (cat === 'Descartáveis & Utilidades') {
    parts.push('Artigo prático e resistente para comércios, lanchonetes, eventos e serviços de entrega.');
  } else if (cat === 'Petiscos & Mercearia') {
    parts.push('Indispensável para mercearias, supermercados, botecos e lanchonetes.');
  } else if (cat === 'Energéticos' || cat === 'Refrigerantes' || cat === 'Sucos, Águas & Chás') {
    parts.push('Bebida refrescante de grande aceitação no mercado, excelente para servir gelada.');
  } else {
    parts.push('Distribuição oficial Xiquim Vargas, garantindo procedência e qualidade.');
  }

  return parts.join(' ');
}
