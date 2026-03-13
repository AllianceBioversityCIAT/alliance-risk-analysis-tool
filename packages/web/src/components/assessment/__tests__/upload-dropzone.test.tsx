import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadDropzone } from '../upload-dropzone';
import { sileo } from 'sileo';

// Mock sileo to spy on error notifications
jest.mock('sileo', () => ({
  sileo: {
    error: jest.fn(),
  },
}));

describe('UploadDropzone', () => {
  const onFilesSelectedMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<UploadDropzone onFilesSelected={onFilesSelectedMock} />);
    expect(screen.getByText(/Drag & drop/i)).toBeInTheDocument();
    expect(screen.getByText(/Browse files/i)).toBeInTheDocument();
  });

  it('allows valid file types based on extension', async () => {
    render(<UploadDropzone onFilesSelected={onFilesSelectedMock} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    const file = new File(['hello'], 'hello.txt', { type: '' });
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(onFilesSelectedMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'hello.txt',
            mimeType: 'text/plain', // Should be resolved from .txt extension
          }),
        ])
      );
    });
  });

  it('rejects invalid file types', async () => {
    render(<UploadDropzone onFilesSelected={onFilesSelectedMock} />);
    const dropzone = screen.getByRole('button', { name: /Upload files drop zone/i });

    const file = new File(['hello'], 'hello.exe', { type: 'application/x-msdownload' });
    
    // Simulate drop
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(sileo.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Invalid file',
          description: expect.stringContaining('unsupported type'),
        })
      );
      expect(onFilesSelectedMock).not.toHaveBeenCalled();
    });
  });

  it('rejects files exceeding maximum size', async () => {
    render(<UploadDropzone onFilesSelected={onFilesSelectedMock} />);
    const dropzone = screen.getByRole('button', { name: /Upload files drop zone/i });

    // Create a dummy file that claims to be 100MB
    const bigFile = new File(['hello'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 100 * 1024 * 1024 });

    // Simulate drop
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [bigFile],
      },
    });

    await waitFor(() => {
      expect(sileo.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Invalid file',
          description: expect.stringContaining('too large'),
        })
      );
      expect(onFilesSelectedMock).not.toHaveBeenCalled();
    });
  });

  it('is disabled when disabled prop is true', () => {
    render(<UploadDropzone onFilesSelected={onFilesSelectedMock} disabled={true} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: /Browse files/i })).toBeDisabled();
  });
});
