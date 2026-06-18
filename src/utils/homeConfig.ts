const getEnv = (key: string, defaultValue = ''): string => {
  const metaEnv = import.meta.env?.[key];
  const procEnv = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return metaEnv || procEnv || defaultValue;
};

export const homeConfig = {
  heroTitle: getEnv(
    'HOME_HERO_TITLE',
    'Write, publish, and share your knowledge. Beautifully minimal.',
  ),
  heroSubtitle: getEnv(
    'HOME_HERO_SUBTITLE',
    'Simple Documents provides an elegant, high-speed, distraction-free environment for organizing documents. Toggle public visibility to immediately share and feature your ideas.',
  ),
  directoryTitle: getEnv('HOME_DIRECTORY_TITLE', 'Featured Creators'),
  directorySubtitle: getEnv(
    'HOME_DIRECTORY_SUBTITLE',
    'Explore public documents shared by our opted-in users.',
  ),
};
