// Hanhala shown on the home page, in Dani's order (25 Oct 2026).
//
// PHOTOS: Dani is sending real photos. To add one:
//   1. Save it as  public/images/hanhala/<slug>.jpg
//      (portrait 4:5, ideally 1200 x 1500 px, face roughly in the upper third)
//   2. Set  photo: '/images/hanhala/<slug>.jpg'  on that person below (one line).
// Until a photo is set, the slot shows a designed placeholder marked "Photo to come".
// No portraits are generated; only real photos go here.

export type HanhalaMember = {
  slug: string;
  name: string;
  surname: string; // used large in the placeholder tile
  hebrewName: string; // '' until Dani supplies it
  role: string;
  photo: string | null;
  bio?: string; // short line, only where the current site already has one
};

export const hanhala: HanhalaMember[] = [
  {
    slug: 'dov-ber-liff',
    name: 'Rabbi Dov Ber Liff',
    surname: 'Liff',
    hebrewName: 'הרב דב בר ליף',
    role: 'Rosh Yeshiva',
    photo: null, // -> '/images/hanhala/dov-ber-liff.jpg'
    bio: 'Graduate of Yeshivat Givat Shaul. His genuine warmth and individual care for every bochur sets the tone for the entire yeshiva.',
  },
  {
    slug: 'larry-shain',
    name: 'Rabbi Larry Shain',
    surname: 'Shain',
    hebrewName: 'הרב לארי שיין',
    role: 'Mashgiach & Administrator',
    photo: null, // -> '/images/hanhala/larry-shain.jpg'
  },
  {
    slug: 'weineman',
    name: 'Rabbi Weineman',
    surname: 'Weineman',
    hebrewName: '',
    role: 'Mashgiach',
    photo: null, // -> '/images/hanhala/weineman.jpg'
  },
  {
    slug: 'yehoshua-liff',
    name: 'Rabbi Yehoshua Liff',
    surname: 'Liff',
    hebrewName: 'הרב יהושע ליף',
    role: 'Maggid Shiur',
    photo: null, // -> '/images/hanhala/yehoshua-liff.jpg'
  },
  {
    slug: 'greenberg',
    name: 'Rabbi Greenberg',
    surname: 'Greenberg',
    hebrewName: '',
    role: 'Maggid Shiur',
    photo: null, // -> '/images/hanhala/greenberg.jpg'
  },
  {
    slug: 'liel-shalom',
    name: "R' Liel Shalom",
    surname: 'Shalom',
    hebrewName: '',
    role: 'Maggid Shiur',
    photo: null, // -> '/images/hanhala/liel-shalom.jpg'
  },
  {
    slug: 'klapper',
    name: 'Rabbi Klapper',
    surname: 'Klapper',
    hebrewName: '',
    role: 'Maggid Shiur',
    photo: null, // -> '/images/hanhala/klapper.jpg'
  },
  {
    slug: 'moti-pogrow',
    name: 'Rabbi Moti Pogrow',
    surname: 'Pogrow',
    hebrewName: '',
    role: 'Maggid Shiur',
    photo: null, // -> '/images/hanhala/moti-pogrow.jpg'
  },
];
