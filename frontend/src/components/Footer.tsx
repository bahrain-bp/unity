import logo from "../assets/logo.png";
function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__logo">
        <img src={logo} alt="footer logo" />
        <h3>BAHTWIN</h3>
      </div>
      <div className="footer__menu">
        <a href="/">Home</a>
        <a href="/information">Information</a>
        <a href="/auth">Register</a>
        <a href="#">Terms & Conditions</a>
      </div>
      <span className="footer__line" />
      <div className="footer__copyright">
        &copy;{year} Bahrain Amazon Web Services. All Rights Reserved
      </div>
    </footer>
  );
}

export default Footer;
