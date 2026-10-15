type FileEntry={index:number};
type SourceSelection={torrent_file_index?:number|null;requires_file_selection?:boolean};

// An uncertain batch must never reuse an addon's index, a saved index or the
// single-file shortcut. The user confirms its actual path after metadata loads.
export function automaticTorrentFileIndex(files:FileEntry[],source:SourceSelection,savedIndex:number|null):number|undefined {
  if(source.requires_file_selection)return undefined;
  const preferred=source.torrent_file_index??savedIndex;
  if(preferred!==null&&preferred!==undefined&&files.some(file=>file.index===preferred))return preferred;
  return files.length===1?files[0].index:undefined;
}
