# Gap Detector UI Components

This folder contains the core React components responsible for the **Gap Detector** feature in the web frontend.

## Purpose

The Gap Detector allows users (Admins or System Operators) to review the AI's analysis of a business plan. It presents the extracted information across the 10 core fields and highlights any missing or incomplete data ("gaps"). Users can read the original documents side-by-side with the AI's findings, manually correct or supply missing information, and submit those corrections for re-validation.

## Core Components

### `gap-field-card.tsx`
The primary interactive element for each of the 10 core fields.
*   **Status Display**: Shows if a field is `COMPLETE`, `PARTIAL`, or `MISSING`.
*   **Original Value**: Displays what the AI extracted from the documents.
*   **Edit Mode**: Allows the user to toggle an editing view to correct the `PARTIAL` or `MISSING` value.
*   **Validation Feedback**: If a user submits an insufficient correction, the backend rejects it, and this card displays the AI's reasoning (`validationFeedback`) below the input field.

### `document-viewer.tsx`
A split-pane container that shows the AI analysis (Gap Field Cards) on one side and the source documents on the other.
*   **Navigation**: Allows users to switch between different uploaded files (PDFs, Word docs, etc.).
*   **Integration**: Wraps the `PdfViewer` or renders raw text/HTML for other document types.

### `pdf-viewer.tsx`
A specialized viewer component built to render PDF files directly in the browser.
*   Uses `react-pdf` to render the pages.
*   Provides zooming and page navigation controls to help users cross-reference the AI's findings with the original document text.

### `gap-layout.tsx`
The main structural layout wrapper for the entire Gap Detector route.
*   Manages the top-level header (which can collapse on small screens or when scrolling).
*   Provides the primary "Analyze Risks" action button which triggers the submission and validation flow.

## State Management & Data Flow

1.  **Fetching Data**: The layout uses TanStack React Query to fetch the list of `GapField` objects for the current assessment.
2.  **Local Edits**: As users edit fields in the `GapFieldCard`, the local state is updated, and an `onUpdate` callback syncs the new value.
3.  **Submission**: Clicking "Analyze Risks" triggers the backend `POST /submit` endpoint.
4.  **Validation Loop**:
    *   If the backend AI accepts the edits, the user is navigated to the Risk Analysis page.
    *   If the backend AI rejects the edits, it returns a `400 Bad Request` with an array of invalid fields. The `gap-field-card` catches this array and displays the `validationFeedback` inline.

## Styling & Design

These components rely heavily on Tailwind CSS and the Shadcn UI library. The color palette emphasizes clarity:
*   **Green (`text-emerald-500`)**: Complete fields.
*   **Yellow/Orange (`text-amber-500`)**: Partial/Incomplete fields requiring attention.
*   **Red (`text-rose-500`)**: Missing fields or validation errors.
