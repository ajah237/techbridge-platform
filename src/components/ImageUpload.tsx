import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  bucket: string;
  folder?: string;
  value?: string | null;
  onUpload: (url: string) => void;
  onRemove?: () => void;
  className?: string;
  accept?: string;
  maxSizeMB?: number;
}

const ImageUpload = ({
  bucket,
  folder = "",
  value,
  onUpload,
  onRemove,
  className = "",
  accept = "image/*",
  maxSizeMB = 5,
}: Props) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File must be under ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${folder ? folder + "/" : ""}${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      toast.error("Upload failed: " + error.message);
    } else {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onUpload(data.publicUrl);
      toast.success("Image uploaded!");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={className}>
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="Upload preview"
            className="w-full h-40 object-cover rounded-lg border border-border"
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove image"
              className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          {uploading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <>
              <Upload size={24} />
              <span className="text-sm">Click to upload image</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleUpload}
        className="hidden"
      />
      {value && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Replace Image"}
        </Button>
      )}
    </div>
  );
};

export default ImageUpload;
