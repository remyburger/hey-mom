import { isSnow, isStorm } from './weather.js';

// bias > 0 means "runs cold": she should dress as if it's colder than forecast.
// Everything is calculated in °F; unit only changes how numbers are shown.
export function recommend(hours, bias = 0, unit = 'F') {
  const t = (f) => temp(f, unit);
  if (!hours || !hours.length) return null;

  const eff = hours.map((h) => h.feels - bias);
  const low = Math.round(Math.min(...eff));
  const high = Math.round(Math.max(...eff));
  const avg = Math.round(eff.reduce((a, b) => a + b, 0) / eff.length);
  const swing = high - low;
  const rain = Math.max(...hours.map((h) => h.rain));
  const rainStart = hours.find((h) => h.rain >= 40)?.hour;
  const wind = Math.round(Math.max(...hours.map((h) => h.wind)));
  const gusts = Math.round(Math.max(...hours.map((h) => h.gust)));
  const uv = Math.max(...hours.map((h) => h.uv));
  const snow = hours.some((h) => isSnow(h.code));
  const storm = hours.some((h) => isStorm(h.code));
  const windy = wind >= 15 || gusts >= 25;
  const wet = rain >= 50 || snow || storm;
  // A big swing only matters if the morning is actually cool
  const layered = swing >= 12 && low < 62;

  const items = [];

  // Top: dress the base layer for the warmest part of the day
  if (high >= 80) items.push({ slot: 'top', icon: 'tank', name: 'Tank or tee', note: 'It gets hot' });
  else if (high >= 68) items.push({ slot: 'top', icon: 'tee', name: 'T-shirt', note: 'Short sleeves are fine' });
  else if (high >= 58) items.push({ slot: 'top', icon: 'longsleeve', name: 'Long sleeve', note: 'Or a tee under your layer' });
  else if (high >= 45) items.push({ slot: 'top', icon: 'sweater', name: 'Sweater or hoodie', note: 'Sweater weather, officially' });
  else items.push({ slot: 'top', icon: 'sweater', name: 'Warm sweater', note: 'Long sleeve underneath' });

  // Bottoms
  if (avg >= 72 && !wet) {
    items.push({ slot: 'bottom', icon: 'shorts', name: windy ? 'Shorts' : 'Shorts or a skirt', note: windy ? 'Too windy for a skirt' : 'Legs approved' });
  } else if (avg >= 62 && !wet) {
    items.push({ slot: 'bottom', icon: 'shorts', name: 'Shorts or jeans', note: low < 58 ? `Shorts are chilly at ${t(low)} in the morning` : 'Your call' });
  } else if (avg >= 40) {
    items.push({ slot: 'bottom', icon: 'pants', name: 'Jeans or leggings', note: 'Not a shorts day' });
  } else {
    items.push({ slot: 'bottom', icon: 'pants', name: 'Jeans or lined leggings', note: 'Tights underneath if you want' });
  }

  // Outer layer: dress for the coldest part (the walk to school)
  const takeOff = layered ? `Easy to take off. It hits ${t(high)} later` : null;
  let layer = null;
  if (snow || low < 32) layer = { icon: 'coat', kind: 'heavycoat', name: 'Heavy coat', note: 'Zip it all the way' };
  else if (low < 45) layer = { icon: wet ? 'raincoat' : 'coat', name: wet ? 'Warm waterproof coat' : 'Warm jacket', note: takeOff || 'All day' };
  else if (low < 58) {
    if (wet) layer = { icon: 'raincoat', name: 'Rain jacket', note: takeOff || 'Hood up' };
    else layer = { icon: 'jacket', name: windy ? 'Windbreaker or jean jacket' : 'Light jacket or flannel', note: takeOff || 'Keep it on' };
  } else if (wet) layer = { icon: 'raincoat', name: 'Rain jacket', note: 'For the rain, not the cold' };
  else if (low < 68 && swing >= 8) layer = { icon: 'jacket', name: 'Light layer', note: "You'll probably carry it by lunch" };
  else if (low < 64 && (windy || rain >= 30)) layer = { icon: 'jacket', name: 'Light jacket', note: windy ? 'The wind makes it feel colder' : 'In case of a sprinkle' };
  if (layer) items.push({ slot: 'layer', ...layer });

  // Shoes
  if (snow || low < 35) items.push({ slot: 'shoes', icon: 'boot', name: 'Boots', note: snow ? 'Snow in the forecast' : 'Warm socks too' });
  else if (wet) items.push({ slot: 'shoes', icon: 'boot', name: 'Waterproof shoes', note: 'Skip the canvas sneakers' });
  else if (high >= 78) items.push({ slot: 'shoes', icon: 'sandal', name: 'Sneakers or sandals', note: 'Either works' });
  else items.push({ slot: 'shoes', icon: 'sneaker', name: 'Sneakers', note: 'The usual' });

  // Extras
  if (rain >= 40 && !snow) items.push({ slot: 'extra', icon: 'umbrella', name: 'Umbrella', note: `${rain}% chance of rain${rainStart != null ? ` around ${fmtHour(rainStart)}` : ''}` });
  if (low < 35) items.push({ slot: 'extra', icon: 'beanie', name: 'Beanie and gloves', note: `Feels like ${t(low)}` });
  if (uv >= 6 && !wet) items.push({ slot: 'extra', icon: 'sunglasses', name: 'Sunglasses', note: 'Sunscreen too, the UV is high' });
  if (windy) items.push({ slot: 'extra', icon: 'hairtie', name: 'Hair tie', note: `Gusts up to ${gusts} mph` });

  // Mom's rule
  let momRule = null;
  if (storm) momRule = 'Thunderstorms are possible. Check the sky before you head out after school.';
  else if (swing >= 15 && low < 62) momRule = `It's ${t(low)} to start and ${t(high)} later. Bring an extra sweater just in case.`;
  else if (rain >= 25 && rain < 50) momRule = `${rain}% chance of rain. Stick a hoodie in your bag just in case.`;
  else if (low < 25) momRule = "It's seriously cold. Coat on, no arguments.";

  return {
    low, high, avg, swing, rain, wind, gusts, windy, wet, snow, storm,
    items,
    momRule,
    headline: headlineFor({ avg, low, swing, wet, snow, storm }),
    summary: summaryFor({ low, high, rain, windy, snow, unit }),
  };
}

function headlineFor({ avg, low, swing, wet, snow, storm }) {
  if (snow) return 'Snow gear day.';
  if (storm || wet) return 'Rain jacket day.';
  if (swing >= 15 && low < 62) return 'Layers day.';
  if (avg < 32) return 'Coat day. The real coat.';
  if (avg < 45) return 'Bundle up.';
  if (avg < 58) return 'Sweater weather.';
  if (avg < 68) return 'Long sleeve weather.';
  if (avg < 78) return 'T-shirt day.';
  return 'Shorts weather.';
}

function summaryFor({ low, high, rain, windy, snow, unit }) {
  const range = rangeText(low, high, unit);
  const extras = [];
  if (windy) extras.push('windy');
  if (rain >= 30) extras.push(`${rain}% chance of ${snow ? 'snow' : 'rain'}`);
  return `Feels like ${range} during school${extras.length ? `, ${extras.join(', ')}` : ''}.`;
}

export function bandFor(avg) {
  if (avg < 32) return 'freezing';
  if (avg < 45) return 'cold';
  if (avg < 58) return 'cool';
  if (avg < 68) return 'mild';
  if (avg < 78) return 'warm';
  return 'hot';
}

export function fmtHour(h) {
  const suffix = h < 12 ? 'AM' : 'PM';
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n} ${suffix}`;
}

export function fmtHourShort(h) {
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n}${h < 12 ? 'a' : 'p'}`;
}

export function biasLabel(bias, unit = 'F') {
  const d = tempDelta(Math.abs(bias), unit);
  if (bias > 0) return `You run ${d}° cold`;
  if (bias < 0) return `You run ${d}° warm`;
  return 'Going by the forecast as is';
}

// What changes between two days' outfits (prev = yesterday, next = the day being viewed)
export function compareDays(prev, next, unit = 'F') {
  if (!prev || !next) return null;
  const changes = [];
  for (const slot of ['top', 'bottom', 'layer', 'shoes']) {
    const a = prev.items.find((i) => i.slot === slot);
    const b = next.items.find((i) => i.slot === slot);
    // Same kind of garment (e.g. "Light layer" vs "Light jacket") isn't a real change
    if (a && b && (a.kind || a.icon) !== (b.kind || b.icon)) changes.push({ kind: 'swap', from: a.name, to: b.name, icon: b.icon });
    else if (!a && b) changes.push({ kind: 'add', to: b.name, icon: b.icon });
    else if (a && !b) changes.push({ kind: 'drop', from: a.name, icon: a.icon });
  }
  const prevExtras = prev.items.filter((i) => i.slot === 'extra');
  const nextExtras = next.items.filter((i) => i.slot === 'extra');
  for (const b of nextExtras) if (!prevExtras.some((a) => a.name === b.name)) changes.push({ kind: 'add', to: b.name, icon: b.icon });
  for (const a of prevExtras) if (!nextExtras.some((b) => b.name === a.name)) changes.push({ kind: 'drop', from: a.name, icon: a.icon });

  return {
    delta: next.avg - prev.avg,
    unit,
    prevRange: rangeText(prev.low, prev.high, unit),
    nextRange: rangeText(next.low, next.high, unit),
    changes,
  };
}

export function deltaText(delta, otherDay, unit = 'F') {
  if (Math.abs(delta) <= 2) return `About the same as ${otherDay}`;
  return `${tempDelta(Math.abs(delta), unit)}° ${delta < 0 ? 'colder' : 'warmer'} than ${otherDay}`;
}

function rangeText(lo, hi, unit = 'F') {
  const a = toUnit(lo, unit), b = toUnit(hi, unit);
  return a === b ? `${a}°` : `${a}–${b}°`;
}

const toUnit = (f, unit) => Math.round(unit === 'C' ? ((f - 32) * 5) / 9 : f);

// A temperature in °F shown in the chosen unit, e.g. temp(50, 'C') -> "10°"
export const temp = (f, unit = 'F') => `${toUnit(f, unit)}°`;

// A difference in °F converted to the chosen unit (no 32° offset)
export const tempDelta = (dF, unit = 'F') => Math.round(unit === 'C' ? (dF * 5) / 9 : dF);
