export const getAppShareUrl = () => {
  return window.location.origin;
};

export const getAppShareMessage = () => {
  return 'Venha treinar comigo no CrossCity Hub! Acompanhe seus treinos, ganhe XP e domine territórios.';
};

export const shareToWhatsApp = ({ title, text, url }: { title: string; text: string; url: string }) => {
  const message = `${title}\n\n${text}\n\n${url}`;
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
};

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy: ', err);
    return false;
  }
};
