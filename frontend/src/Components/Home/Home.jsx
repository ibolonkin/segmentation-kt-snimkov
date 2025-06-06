import React, { useEffect, useState } from 'react';
import './Home.css';
import PhotoSlider from '../PhotoSlider/PhotoSlider';
import { sendPhotoId, uploadFile } from '../../api/commonApi';
import { savePhotoToProfile } from '../../api/profileApi';
import Header from '../Header/Header';
import FileUploadSection from '../FileUploadSection/FileUploadSection';
import useImageCache from '../../hooks/useImageCache';
import { toast } from 'react-toastify';
import ContourEditorModal from '../ContourEditorModal/ContourEditorModal';

const Home = () => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [uuid, setUuid] = useState(localStorage.getItem('uuid') || '');
  const [numSlices, setNumSlices] = useState(localStorage.getItem('numSlices') || '');
  const [photo, setPhoto] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [resultImage, setResultImage] = useState(null);
  const [isChoosed, setIsChoosed] = useState(false);
  const [imageSettings, setImageSettings] = useState(false);
  const [fileMeta, setFileMeta] = useState(() => {
    const isAuthenticated = !!localStorage.getItem('accessToken');
    if (!isAuthenticated) return null;

    const saved = localStorage.getItem('fileMeta');
    return saved ? JSON.parse(saved) : null;
  });
  const [isContourModalOpen, setIsContourModalOpen] = useState(false);

  const { cacheImage, getCachedImage } = useImageCache();

  useEffect(() => {
    if (fileMeta) {
      setUuid(fileMeta.uuid);
      setNumSlices(fileMeta.numSlices);
      setIsUploaded(true);
      setIsChoosed(true);
    }
  }, [fileMeta]);

  useEffect(() => {
    if (fileMeta) {
      localStorage.setItem('fileMeta', JSON.stringify(fileMeta));
    } else {
      localStorage.removeItem('fileMeta');
    }
  }, [fileMeta]);

  useEffect(() => {
    const cachedImage = getCachedImage(uuid, photo);
    if (cachedImage && isChoosed && isUploaded) {
      setResultImage(cachedImage);
    }
  }, [uuid, photo, isChoosed, getCachedImage, isUploaded]);

  useEffect(() => {
    return () => {
      if (resultImage) {
        URL.revokeObjectURL(resultImage);
      }
    };
  }, [resultImage]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    if (selectedFile) {
      if (selectedFile.name.endsWith('.nii')) {
        setFile(selectedFile);
        setError('');
        setIsChoosed(true);
      } else {
        setFile(null);
        toast.error('Загрузить можно только .nii файл');
      }
    }
  };

  const handleUpload = async () => {
    try {
      setIsSent(true);
      const response = await uploadFile(file);

      const { uuid, num_slices } = response;
      setUuid(uuid);
      setNumSlices(num_slices);
      localStorage.setItem('uuid', uuid);
      localStorage.setItem('numSlices', num_slices);

      setFileMeta({
        uuid: response.uuid,
        numSlices: response.num_slices,
        filename: file.name,
        sizeBytes: file.size,
        lastUploaded: new Date().toISOString(),
      });

      setIsUploaded(true);
      setResultImage(null);
    } catch (error) {
      console.log('error', error);
      setIsUploaded(false);
    } finally {
      setIsSent(false);
    }
  };

  const handleSendSlice = async () => {
    try {
      setIsSending(true);

      const cachedImages = JSON.parse(localStorage.getItem('cachedImages') || '{}');
      if (cachedImages[uuid]?.[photo]) {
        setResultImage(cachedImages[uuid][photo]);
        return;
      }

      const blob = await sendPhotoId(uuid, photo);

      const blobUrl = URL.createObjectURL(blob);
      setResultImage(blobUrl);
      await cacheImage(uuid, photo, blob);
    } catch (error) {
      console.error('error while sending id', error);
    } finally {
      setIsSending(false);
    }
  };

  const clickedImage = () => {
    setImageSettings((prev) => !prev);
  };

  const handleDownload = () => {
    if (!resultImage) return;
    toast.success('Фотография загружена!');
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `ct_slice_${photo}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToProfile = async (photoData) => {
    try {
      await savePhotoToProfile(photoData);
    } catch (error) {
      console.error('Ошибка сохранения фотографии', error);
    }
  };

  const clearFileData = () => {
    setFile(null);
    setFileMeta(null);
    setUuid('');
    setNumSlices('');
    setIsUploaded(false);
    setIsChoosed(false);
    setResultImage(null);
  };

  const handleEditContour = async () => {
    if (!localStorage.getItem('accessToken')) {
      toast.error('Для редактирования контура необходимо авторизоваться');
      return;
    }
    setIsContourModalOpen(true);
  };

  return (
    <div className="Home">
      <Header />

      <FileUploadSection
        onFileChange={handleFileChange}
        onUpload={handleUpload}
        file={file}
        error={error}
        isUploading={isSent}
        onClear={clearFileData}
        hasFile={!!fileMeta}
        fileMeta={fileMeta}
      />

      {isUploaded && (
        <div className="slice-controls">
          <div className="current-count">
            <p>{photo}</p>
          </div>
          <PhotoSlider
            photo={photo}
            setPhoto={setPhoto}
            numSlices={numSlices}
          />
          <div className="slice-count">
            <div className="slider-value start-count">0</div>
            <div className="slider-value end-count">{numSlices}</div>
          </div>
        </div>
      )}

      {isUploaded && (
        <div className="slice-actions">
          <button
            onClick={handleSendSlice}
            disabled={!uuid || isSending || !isUploaded}
            className="get-slice-button"
          >
            {isSending ? 'Отправка...' : 'Получить снимок'}
          </button>
        </div>
      )}
      <div className="container-photo">
        {resultImage && (
          <div className="result-img-container">
            <img
              src={resultImage}
              alt={`Срез ${photo}`}
              className="result-sliced-img"
              onClick={clickedImage}
              draggable="false"
            />
            {imageSettings && (
              <div className="settings-buttons">
                <button
                  className="settings-button download"
                  onClick={handleDownload}
                >
                  Скачать
                </button>
                <button
                  className="settings-button save"
                  onClick={() => handleSaveToProfile({ uuid_file: uuid, num_images: photo })}
                >
                  Сохранить в личном кабинете
                </button>
                <button
                  className="settings-button change"
                  onClick={handleEditContour}
                >
                  Изменить контур
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {isContourModalOpen && (
        <ContourEditorModal
          uuid={uuid}
          sliceIndex={photo}
          isOpen={isContourModalOpen}
          onClose={() => setIsContourModalOpen(false)}
          onSave={() => toast.success('Контур успешно сохранён')}
        />
      )}
    </div>
  );
};

export default Home;
