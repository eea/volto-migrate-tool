import installParser from './components/manage/Blocks/Parser';

const config = (config) => {
  return [installParser].reduce((acc, apply) => apply(acc), config);
};

export default config;
