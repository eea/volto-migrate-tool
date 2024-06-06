import worldSVG from '@plone/volto/icons/world.svg';
import Parser from './View';

const config = (config) => {
  config.blocks.blocksConfig.parser = {
    id: 'parser',
    title: 'Parser',
    icon: worldSVG,
    group: 'data_blocks',
    view: Parser,
    edit: Parser,
    restricted: false,
    mostUsed: false,
    sidebarTab: 1,
    security: {
      addPermission: [],
      view: [],
    },
  };
  return config;
};

export default config;
