import './palette.css';

/** The base colors of the palette's first row; the rows under it are lighter and darker shades of each. */
export const THEME_COLORS = ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000',
  '#5b9bd5', '#70ad47'];

/** The bright colors of the palette's last row. */
export const STANDARD_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0',
  '#002060', '#7030a0'];

const toRgb = (hex: string): number[] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]): string => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** A color mixed with white (`amount` > 0) or black (`amount` < 0). */
const mix = (hex: string, amount: number): string => toHex(toRgb(hex).map(v => (amount > 0 ?
  v + (255 - v) * amount : v * (1 + amount))));

/** The five shades under a base color: darker ones for white and light colors, lighter ones for black. */
export const shadesOf = (hex: string): string[] => {
  const [r, g, b] = toRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  if (luminance === 1) {
    return [-0.05, -0.15, -0.25, -0.35, -0.5].map(amount => mix(hex, amount));
  }
  if (luminance > 0.8) {
    return [-0.1, -0.25, -0.5, -0.75, -0.9].map(amount => mix(hex, amount));
  }
  if (luminance === 0) {
    return [0.5, 0.35, 0.25, 0.15, 0.05].map(amount => mix(hex, amount));
  }

  return [0.8, 0.6, 0.4, -0.25, -0.5].map(amount => mix(hex, amount));
};

/** HSV (hue 0–360, saturation and value 0–1) as a hex color. */
const hsvToHex = (h: number, sat: number, val: number): string => {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;

    return 255 * (val - val * sat * Math.max(0, Math.min(k, 4 - k, 1)));
  };

  return toHex([f(5), f(3), f(1)]);
};

/** A hex color as HSV. */
const hexToHsv = (hex: string): [number, number, number] => {
  const [r, g, b] = toRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;

  if (delta) {
    h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  }

  return [(h * 60 + 360) % 360, max ? delta / max : 0, max];
};

type PickerOptions = {
  labels: { ok: string; cancel: string };
  change(color: string): void;
  ok(color: string): void;
  cancel(): void;
};

/**
 * "More colors": a color area (saturation and brightness), a hue slider and a hex field, with OK and Cancel. Every
 * change is shown on the cells; only OK chooses the color (the browser's own color picker cannot tell a cancel apart).
 */
const createPicker = (initial: string, { labels, change, ok, cancel }: PickerOptions): HTMLElement => {
  let [hue, sat, val] = hexToHsv(initial);
  const picker = document.createElement('div');

  picker.className = 'fs-palette__picker';
  picker.innerHTML = '<div class="fs-palette__area"><span class="fs-palette__area-thumb"></span></div>' +
    '<input class="fs-palette__hue" type="range" min="0" max="359" aria-label="Hue">' +
    '<div class="fs-palette__picker-row"><span class="fs-palette__sample"></span>' +
    '<input class="fs-palette__hex" type="text" maxlength="7" spellcheck="false" aria-label="Hex"></div>' +
    '<div class="fs-palette__picker-row fs-palette__picker-buttons">' +
    `<button type="button" class="fs-palette__ok">${labels.ok}</button>` +
    `<button type="button" class="fs-palette__cancel">${labels.cancel}</button></div>`;

  const area = picker.querySelector<HTMLElement>('.fs-palette__area')!;
  const thumb = picker.querySelector<HTMLElement>('.fs-palette__area-thumb')!;
  const hueInput = picker.querySelector<HTMLInputElement>('.fs-palette__hue')!;
  const hexInput = picker.querySelector<HTMLInputElement>('.fs-palette__hex')!;
  const sample = picker.querySelector<HTMLElement>('.fs-palette__sample')!;
  const color = () => hsvToHex(hue, sat, val);
  const draw = (notify: boolean) => {
    area.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${
      hsvToHex(hue, 1, 1)}`;
    thumb.style.left = `${sat * 100}%`;
    thumb.style.top = `${(1 - val) * 100}%`;
    hueInput.value = String(Math.round(hue));
    hueInput.style.background = 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';
    sample.style.background = color();
    if (document.activeElement !== hexInput) {
      hexInput.value = color();
    }
    if (notify) {
      change(color());
    }
  };
  const pointAt = (event: PointerEvent) => {
    const box = area.getBoundingClientRect();

    sat = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    val = 1 - Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
    draw(true);
  };

  let dragging = false;

  area.addEventListener('pointerdown', (event) => {
    dragging = true;
    try {
      // Dragging goes on outside the area.
      area.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser does not know (a synthetic event).
    }
    pointAt(event);
  });
  area.addEventListener('pointermove', (event) => {
    if (dragging) {
      pointAt(event);
    }
  });
  area.addEventListener('pointerup', () => {
    dragging = false;
  });
  area.addEventListener('lostpointercapture', () => {
    dragging = false;
  });
  hueInput.addEventListener('input', () => {
    hue = Number(hueInput.value);
    draw(true);
  });
  hexInput.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(hexInput.value)) {
      [hue, sat, val] = hexToHsv(hexInput.value.toLowerCase());
      draw(true);
    }
  });
  hexInput.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      ok(color());
    }
  });
  picker.querySelector('.fs-palette__ok')!.addEventListener('click', () => ok(color()));
  picker.querySelector('.fs-palette__cancel')!.addEventListener('click', () => cancel());
  draw(false);

  return picker;
};

export type PaletteOptions = {
  /** The labels: the two groups, the "no color" button and the "more colors" button. */
  labels: { theme: string; standard: string; none: string; more: string; ok: string; cancel: string };
  /** A color under the pointer (shown on the cells until the pointer leaves), or `undefined`: show the cells as they are. */
  preview(color: string | null | undefined): void;
  /** The chosen color (`null`: no color). */
  pick(color: string | null): void;
};

/**
 * A color palette: a grid of theme colors with their shades, a row of standard colors, "no color" and "more colors"
 * (a color area with OK and Cancel). Pointing at a color previews it, clicking chooses it.
 */
export const createPalette = ({ labels, preview, pick }: PaletteOptions): HTMLElement => {
  const palette = document.createElement('div');
  const swatches = document.createElement('div');
  const swatchRow = (colors: string[]) => {
    const row = document.createElement('div');

    row.className = 'fs-palette__row';
    colors.forEach((color) => {
      const swatch = document.createElement('button');

      swatch.type = 'button';
      swatch.className = 'fs-palette__swatch';
      swatch.style.background = color;
      swatch.title = color;
      swatch.setAttribute('aria-label', color);
      swatch.dataset.color = color;
      row.appendChild(swatch);
    });

    return row;
  };
  const heading = (text: string) => {
    const element = document.createElement('div');

    element.className = 'fs-palette__heading';
    element.textContent = text;

    return element;
  };
  const shades = THEME_COLORS.map(shadesOf);
  const button = (text: string, className: string) => {
    const element = document.createElement('button');

    element.type = 'button';
    element.className = `fs-palette__button ${className}`;
    element.textContent = text;

    return element;
  };
  const none = button(labels.none, 'fs-palette__none');
  const more = button(labels.more, 'fs-palette__more');
  let lastPreview = '#4472c4';
  let picking = false;
  const showSwatches = () => {
    picking = false;
    palette.replaceChildren(swatches);
  };

  palette.className = 'fs-palette';
  swatches.append(heading(labels.theme), swatchRow(THEME_COLORS),
    ...[0, 1, 2, 3, 4].map(i => swatchRow(shades.map(column => column[i]))),
    heading(labels.standard), swatchRow(STANDARD_COLORS), none, more);
  palette.appendChild(swatches);

  swatches.addEventListener('mouseover', (event) => {
    const target = (event.target as HTMLElement).closest('[data-color], .fs-palette__none');

    if (target) {
      lastPreview = target === none ? lastPreview : (target as HTMLElement).dataset.color!;
      preview(target === none ? null : (target as HTMLElement).dataset.color!);
    }
  });
  // While "more colors" is open, the colors stay on the cells until OK or Cancel (dragging may leave the palette).
  palette.addEventListener('mouseleave', () => {
    if (!picking) {
      preview(void 0);
    }
  });
  // Mouse down, not click: a menu closes on mouse down outside its items. The picker's own controls need their
  // default action (focus, dragging), so only the swatches prevent it.
  palette.addEventListener('mousedown', (event) => {
    event.stopPropagation();
    if (picking) {
      return;
    }
    const target = (event.target as HTMLElement).closest('[data-color], .fs-palette__none, .fs-palette__more');

    event.preventDefault();
    if (target === more) {
      picking = true;
      palette.replaceChildren(createPicker(lastPreview, {
        labels,
        change: color => preview(color),
        ok: color => pick(color),
        cancel: () => {
          preview(void 0);
          showSwatches();
        },
      }));
    } else if (target) {
      pick(target === none ? null : (target as HTMLElement).dataset.color!);
    }
  });
  palette.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && picking) {
      event.stopPropagation();
      preview(void 0);
      showSwatches();
    }
  });

  return palette;
};
