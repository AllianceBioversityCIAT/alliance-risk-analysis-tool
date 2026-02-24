# Upload Business Plan Modal
Figma: https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/?node-id=97:454

## Screenshot Description
Modal for uploading business plan documents. Features a large dropzone area and file list.

## Component Breakdown
- **Modal header**: "Upload Business Plan" title + back arrow + close X
- **Dropzone area**:
  - Dashed border container
  - CloudUpload icon (48px, muted)
  - "Drag & drop files here" primary text
  - "or click to browse" secondary text
  - "Accepted: PDF, DOCX, XLSX (max 25MB)" helper text
- **Uploaded files list** (below dropzone):
  - File row: FileText icon + filename + size + progress bar + remove X
  - States: uploading (with progress), uploaded (green check), error (red X)
- **Footer**: Back button (outlined) + "Upload & Process" button (primary)

## Layout Structure
- Modal: max-w-lg, centered
- Dropzone: full width, h-48, flex items-center justify-center
- File list: flex flex-col gap-2
- Footer: flex justify-between (back on left, action on right)

## shadcn Components Used
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- `Button` (outline for Back, default for Upload)
- `Progress` for file upload progress

## Custom Components Needed
- `src/components/assessment/file-upload-dropzone.tsx` - Drag & drop zone
- `src/components/assessment/file-list-item.tsx` - Individual file row with status
- `src/components/assessment/upload-business-plan-modal.tsx` - Modal container

## Data Requirements
- POST /api/assessments/:id/documents (upload file)
- File upload with multipart/form-data
- Presigned S3 URL workflow possible

## Implementation Notes
- Use native HTML5 drag-and-drop API or a library like react-dropzone
- Show upload progress using XHR/fetch with progress events
- Validate file type and size client-side before upload
- After successful upload, transition to Gap Detector (screen 7)
