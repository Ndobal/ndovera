import { kindForUpload, shrinkForUpload, shrinkImage } from './shrinkImage';

const pictureOf = (bytes, type = 'image/png', name = 'photo.png') => new File([new Uint8Array(bytes)], name, { type });

test('each upload address gets the right kind of picture', () => {
  expect(kindForUpload('/api/school/logo')).toBe('small');
  expect(kindForUpload('/api/people/u1/avatar-upload')).toBe('small');
  expect(kindForUpload('/api/ami/website/sections/upload')).toBe('photo');
  expect(kindForUpload('/api/school/events/upload')).toBe('photo');
  expect(kindForUpload('/api/classrooms/c1/materials/upload-multipart')).toBe('document');
  expect(kindForUpload('/api/teacher-submissions/upload')).toBe('document');
  expect(kindForUpload('/api/school/staff-attendance/face-upload')).toBeNull();
});

test('what is not a picture, or is already small, goes up untouched', async () => {
  const pdf = pictureOf(900000, 'application/pdf', 'notes.pdf');
  expect(await shrinkImage(pdf, 'photo')).toBe(pdf);
  const gif = pictureOf(900000, 'image/gif', 'moving.gif');
  expect(await shrinkImage(gif, 'photo')).toBe(gif);
  const svg = pictureOf(900000, 'image/svg+xml', 'logo.svg');
  expect(await shrinkImage(svg, 'small')).toBe(svg);
  const small = pictureOf(20000);
  expect(await shrinkImage(small, 'photo')).toBe(small);
});

test('a face for attendance is never changed', async () => {
  const face = pictureOf(900000, 'image/jpeg', 'face.jpg');
  expect(await shrinkForUpload(face, '/api/school/staff-attendance/face-upload')).toBe(face);
});

describe('when the browser cannot do it', () => {
  const realCreate = URL.createObjectURL;
  afterEach(() => { URL.createObjectURL = realCreate; });

  test('the original still uploads', async () => {
    const picture = pictureOf(900000);
    URL.createObjectURL = () => { throw new Error('not available'); };
    expect(await shrinkImage(picture, 'photo')).toBe(picture);
  });
});
