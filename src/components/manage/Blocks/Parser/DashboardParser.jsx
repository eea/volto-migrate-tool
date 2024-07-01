import { useEffect, useState, useRef, useMemo } from 'react';
import { cloneDeep } from 'lodash';

import { makeEditor } from '@plone/volto-slate/utils';
import deserialize from '@plone/volto-slate/editor/deserialize';
import { serializeNodesToText } from '@plone/volto-slate/editor/render';
import { v4 as uuid } from 'uuid';

import { debounce } from '@eeacms/volto-migrate-tool/helpers';

import 'jsoneditor/dist/jsoneditor.min.css';

const tableauHost = 'https://tableau-public.discomap.eea.europa.eu';

const parser = typeof window !== 'undefined' && new DOMParser();

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

const blocks = require('./tableau_visualization/blocks.json');
const blocks_layout = require('./tableau_visualization/blocks_layout.json');

const moreInfoSlateFields = ['methodology', 'units', 'body', 'moreInfo'];

export default function DashboardFixer() {
  const jsoneditorEl = useRef(null);
  const [jsoneditor, setJsoneditor] = useState(null);
  const [data, setData] = useState([]);
  const [error, setError] = useState({});
  const editor = useMemo(() => makeEditor(), []);

  useEffect(() => {
    const JSONEditor = require('jsoneditor/dist/jsoneditor.min.js');
    const editor = new JSONEditor(jsoneditorEl.current, {
      onChange: () => {
        debounce(
          () => {
            const data = editor.get().data;
            if (data) {
              setData(data);
            }
          },
          200,
          'jsoneditor:onChange',
        );
      },
    });
    editor.set({
      data,
    });
    setJsoneditor(editor);
    /* eslint-disable-next-line */
  }, []);

  function fixData() {
    if (!data.length) {
      setError({ message: 'No data to fix' });
      return;
    }
    setError({});

    const newData = [];
    const wrongTypes = [];

    data.forEach((item) => {
      if (item['@type'] !== 'tableau_visualization') {
        wrongTypes.push(item['@id']);
        item['@type'] = 'tableau_visualization';
      }
      const dashboardWindow = parser.parseFromString(item.embed, 'text/html');
      // Fix tableau
      const paramsEl = dashboardWindow.querySelectorAll('param');
      const params = {};
      // Get params
      for (const param of paramsEl) {
        const name = param.getAttribute('name');
        const value = decodeURIComponent(param.getAttribute('value'));
        params[name] = value;
      }
      // Get sheetname
      const [, sheetname] = params['name']?.split('/') || [];
      item['tableau_visualization'] = {
        '@id': item['@id'],
        url: tableauHost + `/views/${params['name']}`,
        hideTabs: params['tabs'] === 'no',
        hideToolbar: params['toolbar'] === 'no',
        toolbarPosition: 'Top',
        sheetname,
        fullwidth: true,
      };
      delete item.embed;

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

      newData.push(item);
    });

    if (wrongTypes.length) {
      console.log('There are items of wrong type', wrongTypes);
    }

    jsoneditor.set({
      data: newData,
    });

    setData(newData);
  }

  function download() {
    if (!data.length) {
      setError({ message: 'No data to download' });
      return;
    }
    setError({});
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2),
    )}`;
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'fixed_data.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  return (
    <div class="dashboard-fixer grid grid-cols-[2fr_1fr] gap-x-8">
      <div class="dashboard-fixer__content">
        <h2 class="text-2xl mb-2">Dashboard</h2>
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
                if (typeof result == 'string') {
                  // @ts-ignore
                  data = JSON.parse(event.target.result) || [];
                }
                jsoneditor.set({
                  data,
                });
                setData(data);
              };
              reader.readAsText(event.target.files[0]);
            }}
          />
        </div>
        <div class="mb-2 flex gap-x-4">
          <button class="bg-white text-black px-10" onClick={fixData}>
            Fix
          </button>
          <button class="bg-white text-black px-10" onClick={download}>
            Download
          </button>
        </div>
        {error.message && <p class="text-red-500">{error.message}</p>}
        <br />
        <div ref={jsoneditorEl} id="jsoneditor" class="h-[700px]" />
      </div>
    </div>
  );
}
