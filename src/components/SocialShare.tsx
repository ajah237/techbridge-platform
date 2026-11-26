import { Twitter, Linkedin, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SocialShareProps {
  title: string;
  url?: string;
  description?: string;
}

const SocialShare = ({ title, url, description }: SocialShareProps) => {
  const shareUrl = url || window.location.href;
  const text = description ? `${title} - ${description}` : title;

  const links = [
    {
      label: "Twitter",
      icon: Twitter,
      href: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <Share2 size={14} className="text-muted-foreground" />
      <span className="text-sm text-muted-foreground mr-1">Share</span>
      {links.map((l) => (
        <Button
          key={l.label}
          variant="outline"
          size="icon"
          className="h-8 w-8"
          asChild
          title={`Share on ${l.label}`}
        >
          <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${l.label}`}>
            <l.icon size={14} />
          </a>
        </Button>
      ))}
    </div>
  );
};

export default SocialShare;
