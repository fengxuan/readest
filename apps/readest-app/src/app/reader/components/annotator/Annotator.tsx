import React, { useState, useEffect, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { FiCopy } from 'react-icons/fi';
import { PiHighlighterFill } from 'react-icons/pi';
import { FaWikipediaW } from 'react-icons/fa';
import { BsPencilSquare } from 'react-icons/bs';
import { RiDeleteBinLine } from 'react-icons/ri';
import { BsTranslate } from 'react-icons/bs';
import { SiDeepl } from 'react-icons/si';

import { Overlayer } from 'foliate-js/overlayer.js';
import { useEnv } from '@/context/EnvContext';
import { BookNote, HighlightColor, HighlightStyle } from '@/types/book';
import { uniqueId } from '@/utils/misc';
import { useReaderStore } from '@/store/readerStore';
import { useFoliateEvents } from '../../hooks/useFoliateEvents';
import { getPopupPosition, getPosition, Position, TextSelection } from '@/utils/sel';
import { eventDispatcher } from '@/utils/event';
import Toast from '@/components/Toast';
import AnnotationPopup from './AnnotationPopup';
import WiktionaryPopup from './WiktionaryPopup';
import WikipediaPopup from './WikipediaPopup';
import DeepLPopup from './DeepLPopup';

const Annotator: React.FC<{ bookKey: string }> = ({ bookKey }) => {
  const { envConfig } = useEnv();
  const { settings, saveConfig, getProgress, updateBooknotes } = useReaderStore();
  const { getConfig, getBookData, getView, getViewsById } = useReaderStore();
  const { notebookNewAnnotation, setNotebookVisible, setNotebookNewAnnotation } = useReaderStore();
  const globalReadSettings = settings.globalReadSettings;
  const config = getConfig(bookKey)!;
  const progress = getProgress(bookKey)!;
  const bookData = getBookData(bookKey)!;
  const view = getView(bookKey);

  const isShowingPopup = useRef(false);
  const isTextSelected = useRef(false);
  const [selection, setSelection] = useState<TextSelection | null>();
  const [showAnnotPopup, setShowAnnotPopup] = useState(false);
  const [showWiktionaryPopup, setShowWiktionaryPopup] = useState(false);
  const [showWikipediaPopup, setShowWikipediaPopup] = useState(false);
  const [showDeepLPopup, setShowDeepLPopup] = useState(false);
  const [trianglePosition, setTrianglePosition] = useState<Position>();
  const [annotPopupPosition, setAnnotPopupPosition] = useState<Position>();
  const [dictPopupPosition, setDictPopupPosition] = useState<Position>();
  const [toastMessage, setToastMessage] = useState('');
  const [highlightOptionsVisible, setHighlightOptionsVisible] = useState(false);

  const [selectedStyle, setSelectedStyle] = useState<HighlightStyle>(
    globalReadSettings.highlightStyle,
  );
  const [selectedColor, setSelectedColor] = useState<HighlightColor>(
    globalReadSettings.highlightStyles[selectedStyle],
  );

  const dictPopupWidth = 400;
  const dictPopupHeight = 300;
  const annotPopupWidth = 280;
  const annotPopupHeight = 44;
  const popupPadding = 10;

  const onLoad = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { doc, index } = detail;
    const handlePointerup = () => {
      const sel = doc.getSelection();
      if (sel && sel.toString().trim().length > 0 && sel.rangeCount > 0) {
        isTextSelected.current = true;
        setSelection({ key: bookKey, text: sel.toString(), range: sel.getRangeAt(0), index });
      }
    };
    detail.doc?.addEventListener('pointerup', handlePointerup);
  };

  const onDrawAnnotation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { draw, annotation, doc, range } = detail;
    const { style, color } = annotation as BookNote;
    if (style === 'highlight') {
      draw(Overlayer.highlight, { color });
    } else if (['underline', 'squiggly'].includes(style as string)) {
      const { defaultView } = doc;
      const node = range.startContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      const { writingMode } = defaultView.getComputedStyle(el);
      draw(Overlayer[style as keyof typeof Overlayer], { writingMode, color });
    }
  };

  const onShowAnnotation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { value: cfi, index, range } = detail;
    const { booknotes = [] } = config;
    const annotations = booknotes.filter((booknote) => booknote.type === 'annotation');
    const annotation = annotations.find((annotation) => annotation.cfi === cfi);
    if (!annotation) return;
    const selection = { key: bookKey, annotated: true, text: annotation.text ?? '', range, index };
    setSelectedStyle(annotation.style!);
    setSelectedColor(annotation.color!);
    setSelection(selection);
    console.log('show annotation', selection);
  };

  useFoliateEvents(view, { onLoad, onDrawAnnotation, onShowAnnotation }, [config]);

  const handleDismissPopup = () => {
    setSelection(null);
    setShowAnnotPopup(false);
    setShowWiktionaryPopup(false);
    setShowWikipediaPopup(false);
    setShowDeepLPopup(false);
    isShowingPopup.current = false;
  };

  const handleDismissPopupAndSelection = () => {
    handleDismissPopup();
    view?.deselect();
    isTextSelected.current = false;
  };

  useEffect(() => {
    const handleSingleClick = (): boolean => {
      if (isTextSelected.current) {
        view?.deselect();
        isTextSelected.current = false;
        return true;
      }
      if (showAnnotPopup || isShowingPopup.current) {
        return true;
      }
      return false;
    };

    eventDispatcher.onSync('iframe-single-click', handleSingleClick);
    return () => {
      eventDispatcher.offSync('iframe-single-click', handleSingleClick);
    };
  }, []);

  useEffect(() => {
    setHighlightOptionsVisible(!!(selection && selection.annotated));
    if (selection && selection.text.trim().length > 0) {
      const gridFrame = document.querySelector(`#gridcell-${bookKey}`);
      if (!gridFrame) return;
      const rect = gridFrame.getBoundingClientRect();
      const triangPos = getPosition(selection.range, rect);
      const annotPopupPos = getPopupPosition(
        triangPos,
        rect,
        annotPopupWidth,
        annotPopupHeight,
        popupPadding,
      );
      const dictPopupPos = getPopupPosition(
        triangPos,
        rect,
        dictPopupWidth,
        dictPopupHeight,
        popupPadding,
      );
      if (triangPos.point.x == 0 || triangPos.point.y == 0) return;
      setShowAnnotPopup(true);
      setAnnotPopupPosition(annotPopupPos);
      setDictPopupPosition(dictPopupPos);
      setTrianglePosition(triangPos);
      isShowingPopup.current = true;
    }
  }, [selection, bookKey]);

  useEffect(() => {
    const timer = setTimeout(() => setToastMessage(''), 2000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleCopy = () => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    setToastMessage('Copied to notebook');

    const { booknotes: annotations = [] } = config;
    if (selection) navigator.clipboard.writeText(selection.text);
    const { sectionHref: href } = progress;
    const cfi = view?.getCFI(selection.index, selection.range);
    if (!cfi) return;
    const annotation: BookNote = {
      id: uniqueId(),
      type: 'excerpt',
      cfi,
      href,
      text: selection.text,
      note: '',
      created: Date.now(),
    };

    const existingIndex = annotations.findIndex(
      (annotation) => annotation.cfi === cfi && annotation.type === 'excerpt',
    );
    if (existingIndex !== -1) {
      annotations[existingIndex] = annotation;
    } else {
      annotations.push(annotation);
    }
    const updatedConfig = updateBooknotes(bookKey, annotations);
    if (updatedConfig) {
      saveConfig(envConfig, bookKey, updatedConfig, settings);
    }
    setHighlightOptionsVisible(false);
    setNotebookVisible(true);
  };

  const handleHighlight = (update = false) => {
    if (!selection || !selection.text) return;
    setHighlightOptionsVisible(true);
    const { booknotes: annotations = [] } = config;
    const { sectionHref: href } = progress;
    const cfi = view?.getCFI(selection.index, selection.range);
    if (!cfi) return;
    const style = globalReadSettings.highlightStyle;
    const color = globalReadSettings.highlightStyles[style];
    const annotation: BookNote = {
      id: uniqueId(),
      type: 'annotation',
      cfi,
      href,
      style,
      color,
      text: selection.text,
      note: '',
      created: Date.now(),
    };
    const existingIndex = annotations.findIndex(
      (annotation) => annotation.cfi === cfi && annotation.type === 'annotation',
    );
    const views = getViewsById(bookKey.split('-')[0]!);
    if (existingIndex !== -1) {
      views.forEach((view) => view?.addAnnotation(annotation, true));
      if (update) {
        annotations[existingIndex] = annotation;
        views.forEach((view) => view?.addAnnotation(annotation));
      } else {
        annotations.splice(existingIndex, 1);
        setShowAnnotPopup(false);
      }
    } else {
      annotations.push(annotation);
      views.forEach((view) => view?.addAnnotation(annotation));
      setSelection({ ...selection, annotated: true });
    }

    const updatedConfig = updateBooknotes(bookKey, annotations);
    if (updatedConfig) {
      saveConfig(envConfig, bookKey, updatedConfig, settings);
    }
  };

  const handleAnnotate = () => {
    if (!selection || !selection.text) return;
    const { sectionHref: href } = progress;
    selection.href = href;
    setHighlightOptionsVisible(false);
    setNotebookVisible(true);
    setNotebookNewAnnotation(selection);
    handleHighlight(true);
  };

  const handleSearch = () => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    eventDispatcher.dispatch('search', { term: selection.text });
  };

  const handleDictionary = () => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    setShowWiktionaryPopup(true);
  };

  const handleWikipedia = () => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    setShowWikipediaPopup(true);
  };

  const handleTranslation = () => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    setShowDeepLPopup(true);
  };

  const selectionAnnotated = selection?.annotated;
  const buttons = [
    { tooltipText: 'Copy', Icon: FiCopy, onClick: handleCopy },
    {
      tooltipText: selectionAnnotated ? 'Delete Highlight' : 'Highlight',
      Icon: selectionAnnotated ? RiDeleteBinLine : PiHighlighterFill,
      onClick: handleHighlight,
    },
    { tooltipText: 'Annotate', Icon: BsPencilSquare, onClick: handleAnnotate },
    { tooltipText: 'Search', Icon: FiSearch, onClick: handleSearch },
    { tooltipText: 'Dictionary', Icon: BsTranslate, onClick: handleDictionary },
    { tooltipText: 'Translate', Icon: SiDeepl, onClick: handleTranslation },
    { tooltipText: 'Wikipedia', Icon: FaWikipediaW, onClick: handleWikipedia },
  ];

  return (
    <div>
      {(showAnnotPopup || showWiktionaryPopup || showWikipediaPopup || showDeepLPopup) &&
        !notebookNewAnnotation && (
          <div
            className='fixed inset-0'
            onClick={handleDismissPopupAndSelection}
            onContextMenu={handleDismissPopup}
          />
        )}
      {showWiktionaryPopup && trianglePosition && dictPopupPosition && (
        <WiktionaryPopup
          word={selection?.text as string}
          lang={bookData.bookDoc?.metadata.language as string}
          position={dictPopupPosition}
          trianglePosition={trianglePosition}
          popupWidth={dictPopupWidth}
          popupHeight={dictPopupHeight}
        />
      )}
      {showWikipediaPopup && trianglePosition && dictPopupPosition && (
        <WikipediaPopup
          text={selection?.text as string}
          lang={bookData.bookDoc?.metadata.language as string}
          position={dictPopupPosition}
          trianglePosition={trianglePosition}
          popupWidth={dictPopupWidth}
          popupHeight={dictPopupHeight}
        />
      )}
      {showDeepLPopup && trianglePosition && dictPopupPosition && (
        <DeepLPopup
          text={selection?.text as string}
          position={dictPopupPosition}
          trianglePosition={trianglePosition}
          popupWidth={dictPopupWidth}
          popupHeight={dictPopupHeight}
        />
      )}
      {showAnnotPopup && trianglePosition && annotPopupPosition && (
        <AnnotationPopup
          buttons={buttons}
          position={annotPopupPosition}
          trianglePosition={trianglePosition}
          highlightOptionsVisible={highlightOptionsVisible}
          selectedStyle={selectedStyle}
          selectedColor={selectedColor}
          popupWidth={annotPopupWidth}
          popupHeight={annotPopupHeight}
          onHighlight={handleHighlight}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
};

export default Annotator;
