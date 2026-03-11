;(function($, window, document) {
	"use strict";

	function menuArrows() {
		var mobW = $(".site-header").attr("data-mobile-menu-resolution");
		if (window.outerWidth < mobW || $(".site-header").hasClass(".mobile-header")) {
			if (!$(".site-header .menu-item-has-children i.fa-chevron-down").length) {
				$(".site-header .menu-item-has-children").append('<i class="fas fa-chevron-down"></i>');
				$(".site-header .menu-item-has-children i.fa-chevron-down").addClass("hide-drop");
			}

			$(".site-header .menu-item-has-children i.fa-chevron-down").on("click", function() {
				if (!$(this).hasClass("animation")) {
					$(this).parent().toggleClass("is-open");
					$(this).addClass("animation");
					$(this).parent().siblings().removeClass("is-open").find(".fas").removeClass("hide-drop").prev(".sub-menu").slideUp(250);
					if ($(this).hasClass("hide-drop")) {
						if ($(this).closest(".sub-menu").length) {
							$(this).removeClass("hide-drop").prev(".sub-menu").slideToggle(250)
						} else {
							$(".site-header .menu-item-has-children i").addClass("hide-drop").next(".sub-menu").hide(250);
							$(this).removeClass("hide-drop").prev(".sub-menu").slideToggle(250)
						}
					} else {
						$(this).addClass("hide-drop").prev(".sub-menu").hide(100).find(".site-header .menu-item-has-children a").addClass("hide-drop").prev(".sub-menu").hide(250)
					}
				}

				setTimeout(removeClass, 250);

				function removeClass() {
					$(".site-header .site-main-menu i.fa-chevron-down").removeClass("animation")
				}
			})
		} else {
			$(".site-header .menu-item-has-children i.fa-chevron-down").remove()
		}
	}

	$(".additional-nav").on("click", function(e) {
		e.preventDefault();
		$(".additional-menu-wrapper").addClass("menu-open");
		$(".menu-wrapper").addClass("additional-menu-open")
	});
	$(".additional-nav-close, .additional-menu-overlay").on("click", function() {
		$(".additional-menu-wrapper").removeClass("menu-open");
		$(".menu-wrapper").removeClass("additional-menu-open")
	});

	$(window).on("load resize", function() {
		menuArrows();
	});
})(jQuery, window, document);