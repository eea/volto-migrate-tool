import { makeEditor } from '@plone/volto-slate/utils';
import deserialize from '@plone/volto-slate/editor/deserialize';
import { serializeNodesToText } from '@plone/volto-slate/editor/render';
import { v4 as uuid } from 'uuid';
import { useState, useMemo, useRef } from 'react';
import { cloneDeep } from 'lodash';

function createSlate(value, plaintext) {
  return {
    '@type': 'slate',
    instructions: {
      data:
        '<p>Any additional information goes here, like methodology or links to other supporting information</p>',
    },
    placeholder: 'Type optional extra information',
    plaintext,
    value,
  };
}

const moreInfoSlateFields = ['methodology', 'units', 'body', 'moreInfo'];

const blocks_chart_static = require('./chart_static/blocks.json');
const blocks_map_static = require('./map_static/blocks.json');
const blocks_layout_chart_static = require('./chart_static/blocks_layout.json');
const blocks_layout_map_static = require('./map_static/blocks_layout.json');

export default function Parser() {
  const [data, setData] = useState([]);
  const [fixed, setFixed] = useState(false);
  const editor = useMemo(() => makeEditor(), []);

  function fixData() {
    const newData = [];
    const wrongTypes = [];

    for (const item of data) {
      if (!['chart_static', 'map_static'].includes(item['@type'])) {
        wrongTypes.push(item['@id']);
        item['@type'] = 'map_static';
      }
      const blocks =
        item['@type'] === 'chart_static'
          ? cloneDeep(blocks_chart_static)
          : cloneDeep(blocks_map_static);
      const blocks_layout =
        item['@type'] === 'chart_static'
          ? cloneDeep(blocks_layout_chart_static)
          : cloneDeep(blocks_layout_map_static);
      const slates = [];

      for (const field of moreInfoSlateFields) {
        if (!item[field] || item[field]['content-type'] !== 'text/html') {
          continue;
        }
        try {
          const body = new DOMParser().parseFromString(
            item[field].data,
            'text/html',
          ).body;
          const value = deserialize(editor, body, {
            collapseWhitespace: false,
          });
          const data = createSlate(value, serializeNodesToText(value || []));
          slates.push({
            uid: uuid(),
            data,
          });
        } catch {}
        delete item[field];
      }

      for (const blockId in blocks) {
        if (
          blockId !== 'undefined' &&
          blocks[blockId].title === 'Metadata section'
        ) {
          const tabBlockId = blocks[blockId].data.blocks_layout.items[0];
          const tabBlocks = blocks[blockId].data.blocks[tabBlockId].data.blocks;
          for (const $tabBlockId in tabBlocks) {
            if (
              $tabBlockId !== 'undefined' &&
              tabBlocks[$tabBlockId].title === 'More info'
            ) {
              for (const block of slates) {
                blocks[blockId].data.blocks[tabBlockId].data.blocks[
                  $tabBlockId
                ].blocks[block.uid] = block.data;
                blocks[blockId].data.blocks[tabBlockId].data.blocks[
                  $tabBlockId
                ].blocks_layout.items.push(block.uid);
              }
            }
          }
        }
      }

      newData.push({
        ...item,
        blocks,
        blocks_layout,
      });
    }

    console.log(wrongTypes);

    setData(newData);
    setFixed(true);
  }

  function download() {
    const p = 0;
    const maxSlice = 1000;

    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data.slice(p * maxSlice, (p + 1) * maxSlice)),
    )}`;
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'fixed_data.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  return (
    <>
      <div class="mb-2">
        <input
          type="file"
          id="input"
          name="input"
          accept="application/json"
          onChange={(event) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              let data = [];
              const result = event.target.result;
              if (typeof result === 'string') {
                // @ts-ignore
                data = JSON.parse(event.target.result) || [];
              }
              setData(data);
              setFixed(false);
            };
            reader.readAsText(event.target.files[0]);
          }}
        />
      </div>
      <div>
        {/* biome-ignore lint/a11y/useButtonType: <explanation> */}
        <button onClick={fixData}>Fix</button>
        {/* biome-ignore lint/a11y/useButtonType: <explanation> */}
        <button onClick={download}>Download</button>
      </div>
      {fixed && <p>Ready to download</p>}
    </>
  );
}
