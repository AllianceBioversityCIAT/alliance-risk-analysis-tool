import UploadClient from './upload-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function UploadPage() {
  return <UploadClient />;
}
