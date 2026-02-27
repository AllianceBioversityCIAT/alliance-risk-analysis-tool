'use client';

import { useState, useRef } from 'react';
import { Upload, FileJson, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useImportPrompts, type ImportResult } from '@/hooks/use-prompts';
import type { CreatePromptPayload } from '@/hooks/use-prompts';

interface PromptImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportMode = 'create_new' | 'upsert';

export function PromptImportDialog({ open, onOpenChange }: PromptImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedPrompts, setParsedPrompts] = useState<CreatePromptPayload[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>('create_new');
  const [result, setResult] = useState<ImportResult | null>(null);

  const importMutation = useImportPrompts();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const json = JSON.parse(text);

        // Support both { data: [...] } and raw array formats
        const prompts = Array.isArray(json) ? json : json.data;
        if (!Array.isArray(prompts)) {
          setParseError('Invalid format: expected a JSON array or an object with a "data" array.');
          setParsedPrompts([]);
          return;
        }

        // Basic validation
        const validated = prompts.filter(
          (p: Record<string, unknown>) => p.name && p.section && p.systemPrompt && p.userPromptTemplate,
        );

        if (validated.length === 0) {
          setParseError('No valid prompts found. Each prompt must have name, section, systemPrompt, and userPromptTemplate.');
          setParsedPrompts([]);
          return;
        }

        setParsedPrompts(validated as CreatePromptPayload[]);
      } catch {
        setParseError('Failed to parse JSON file. Please check the format.');
        setParsedPrompts([]);
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (parsedPrompts.length === 0) return;

    try {
      const importResult = await importMutation.mutateAsync({
        prompts: parsedPrompts,
        mode,
      });
      setResult(importResult);
      sileo.success({
        title: 'Import complete',
        description: `${importResult.created} created, ${importResult.updated} updated${importResult.errors.length > 0 ? `, ${importResult.errors.length} errors` : ''}`,
      });
    } catch {
      sileo.error({
        title: 'Import failed',
        description: 'An error occurred during import. Please try again.',
      });
    }
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setParsedPrompts([]);
      setFileName(null);
      setParseError(null);
      setResult(null);
      setMode('create_new');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Import Prompts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {fileName ?? 'Select JSON file'}
            </Button>
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {parsedPrompts.length > 0 && !result && (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <FileJson className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{parsedPrompts.length}</span> prompts ready to import
              </div>

              {/* Preview table */}
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">#</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Name</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPrompts.map((p, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-1.5 truncate max-w-[200px]">{p.name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{p.section}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mode selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Import Mode</label>
                <Select value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_new">Create new (skip existing)</SelectItem>
                    <SelectItem value="upsert">Upsert (update matching by name + section)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Result summary */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4" />
                Import complete
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-semibold text-foreground">{result.created}</p>
                  <p className="text-xs text-muted-foreground">Created</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-semibold text-foreground">{result.updated}</p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-semibold text-foreground">{result.errors.length}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-sm">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-destructive">
                      #{err.index + 1} {err.name}: {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={parsedPrompts.length === 0 || importMutation.isPending}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${parsedPrompts.length} Prompt${parsedPrompts.length !== 1 ? 's' : ''}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
